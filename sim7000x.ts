/**
 * sim7000x block
 */

//% color=#179600 icon="\uf093"
namespace sim7000x {

	export enum LoggingLevel {
		DISABLED = 0,
		VERBOSE = 1, //Only human readable messages will be logged
		AT_CMDS = 2, //this mean that full(cmd+response) AT communication between modem and microbit will be logged
	}

	let sim7000TXPin=SerialPin.P1
	let sim7000RXPin=SerialPin.P0
	let sim7000BaudRate=BaudRate.BaudRate115200

	//network APN name, defined by user in initialization of network functions
	let apnName="internet"

	//switches for debug purposes
	let usbLoggingLevel = LoggingLevel.VERBOSE
	let echoEnabled = false //should be alsways on false during normal operation

	//signal quality report variables
	let last_csq_ts = 0
	let last_csq_value = 0
	let csq_min_interval = 3000

  //Handler functions
	let smsReceivedHandler=function(fromNumber: string, message: string){}
	let mqttSubscribeHandler=function(topic: string, message: string){}
	let mqttSubscribeTopics: string[] = []

	let httpsConnected=false

	/**
	* (internal function)
	*/
	function sendATCommand(atCommand: string, timeout=1000, useNewLine=true, forceLogDisable=false, additionalWaitTime=0): string {
			serial.readString() //way to empty buffer
			if(useNewLine){
				serial.writeLine(atCommand)
			}else{
				serial.writeString(atCommand)
			}

			let startTs = input.runningTime()
			let buffer = ""

			while ( (input.runningTime() - startTs <= timeout) || (timeout==-1) ) { //read until timeout is not exceeded
				buffer += serial.readString()
				if (buffer.includes("OK") || buffer.includes("ERROR")) { //command completed, modem responded
		  		break
				}
			}

			if(additionalWaitTime>0){
				basic.pause(additionalWaitTime)
				buffer += serial.readString()
			}

			if(!forceLogDisable){ //for criticial AT command usb logging should be disabled, due to stability issues
				USBSerialLog("Command: "+atCommand+"\r\nResponse: "+buffer,2)
			}
			return buffer
	}

	/**
	* (internal function)
	*/
	function sendATCommandCheckACK(atCommand: string, limit=5): boolean {
			let tries=0
			let modemResponse = sendATCommand(atCommand,-1)
			while(!modemResponse.includes("OK")){
					if(tries>limit){
						return false
					}
					modemResponse = sendATCommand(atCommand,-1)
					basic.pause(100*tries) //adaptively extend pause during sending commands which fail
					tries++

			}
			return true
	}

	/**
	* (internal function)
	*/
	function setupHandlers(){
		//attach listener
		USBSerialLog("Handlers init...",1)
		if(!echoEnabled){ //In case echo is enabled handlers will not work!
			serial.onDataReceived("+", function () {
				basic.pause(50)
				let dataRaw = serial.readString()
				let data = dataRaw.substr(dataRaw.indexOf("+"),dataRaw.length)

				if(data.includes("SMSUB:")){ //MQTT subscription received
					for(let i=0; i<mqttSubscribeTopics.length; i++){
						if(data.includes(mqttSubscribeTopics[i])){
							let message = (data.split('","')[1]) // extract message from AT Response
							USBSerialLog('MQTT subscription on topic: "'+mqttSubscribeTopics[i]+'" received content:"'+message.slice(0,-3)+'"',1)
							mqttSubscribeHandler(mqttSubscribeTopics[i], message.slice(0,-3))
						}
					}
				}
				else if(data.includes("CMTI:")){ //SMS received
					let msgId=trimString(data.split(",")[1])
					let smsRaw=sendATCommand("AT+CMGR="+msgId)
					let smsContent = trimString(smsRaw.split("\n")[2])
					let smsHeader = smsRaw.split("\n")[1]
					let senderPhoneNum =(smsHeader.split(","))[1]
					senderPhoneNum = senderPhoneNum.slice(1,senderPhoneNum.length-1)
					USBSerialLog("Received SMS with id:"+msgId+" message:"+smsContent,1)
					smsReceivedHandler(senderPhoneNum,smsContent)
					sendATCommand("AT+CMGD=0,1") // delete readed message, to prevent memory exhaustion
				}
				else if(data.includes("SHREQ:")){
					let dataSplit = data.split(",")
					let responseCode = dataSplit[1]
					let responseLength = dataSplit[2]
					USBSerialLog("got http response, code:"+responseCode+" ,content length:"+responseLength,1)
				}
				else if(data.includes("SHSTATE: 0")){
					USBSerialLog("ups")
					httpsConnected = false
				}
			})
		}
	}

	/**
	* (internal function)
	*/
	function ensureGsmConnection(){
		let gsmStatus=getGSMRegistrationStatus()
		while(!(gsmStatus==1 || gsmStatus==5)){
			gsmStatus=getGSMRegistrationStatus()
			basic.pause(500)
			USBSerialLog("Waiting for GSM network",1)
		}
	}


	/**
	* (internal function)
	*/
	function ensureGprsConnection(){
		sendATCommand('AT+CNACT=1,"'+apnName+'"')
		basic.pause(1000)
		let netStatus=sendATCommand('AT+CNACT?')
		let tries = 0
		while(!netStatus.includes("+CNACT: 1")){
			if(tries>=8){
				USBSerialLog("",1)
				sendATCommand('AT+CNACT=1,"'+apnName+'"')
				tries=0
			}
			basic.pause(1000)
			USBSerialLog("Waiting for GPRS network connection",1)
			netStatus=sendATCommand('AT+CNACT?')
			tries++
		}
	}

	/**
	* Init module
	*/
	//% weight=100 blockId="sim7000Init"
	//% block="sim7000x Init RX: %sim7000RX_Pin TX: %sim7000TX_Pin Baud:%sim7000BaudRate Logging level: %loggingLevel"
	//% sim7000TX_Pin.defl=SerialPin.P1 sim7000RX_Pin.defl=SerialPin.P0 sim7000BaudRate.defl=BaudRate.BaudRate115200 group="1. Setup: "
	export function init(sim7000TX_Pin: SerialPin, sim7000RX_Pin: SerialPin, sim7000BaudRate: BaudRate, loggingLevel?: LoggingLevel) {
			sim7000RXPin=sim7000RX_Pin
			sim7000TXPin=sim7000TX_Pin
			sim7000BaudRate=sim7000BaudRate
			usbLoggingLevel = loggingLevel

			serial.redirect(sim7000RXPin, sim7000TXPin, sim7000BaudRate)
			serial.setWriteLinePadding(0)
			serial.setRxBufferSize(128)

			let atResponse = sendATCommand("AT")
			while(!atResponse.includes("OK")){ //check in loop if echo is enabled
				atResponse = sendATCommand("AT",1000)
				USBSerialLog("Trying to comunicate with modem...",1)
			}
			sendATCommand("ATE "+(echoEnabled ? "1":"0"))
			sendATCommand("AT+CMEE=2") // extend error logging
			sendATCommand("AT+CMGF=1") // sms message text mode
			sendATCommand("AT+CMGD=0,4") // delete all sms messages
			setupHandlers()
			USBSerialLog("Init done...",1)
	}

	/**
	* get signal strength,
	* return in 1-5 range
	* return -1 if something is wrong and signal can't be fetched
	*/
	//% weight=100 blockId="getSignalQuality"
	//% block="sim7000x Signal quality" group="2. Status: "
	export function getSignalQuality(): number {
			if(input.runningTime() - last_csq_ts > csq_min_interval){
				let signalStrengthRaw = sendATCommand("AT+CSQ")
				let signalStrengthLevel = -1
				if (signalStrengthRaw.includes("+CSQ:")) {
					signalStrengthRaw = signalStrengthRaw.split(": ")[1]
					signalStrengthRaw = signalStrengthRaw.split(",")[0]
					if(parseInt(signalStrengthRaw) != 99){ // 99 means that signal can't be fetched
						signalStrengthLevel = Math.round(Math.map(parseInt(signalStrengthRaw), 0, 31, 1, 5))
					}
				}
				last_csq_ts = input.runningTime()
				last_csq_value=signalStrengthLevel
			}
			return last_csq_value
	}

	/**
	* Display signal strength on led matrix
	*/
	//% weight=100 blockId="displaySignalQuality"
	//% block="sim7000x Dispaly signal quality" group="2. Status: "
	export function displaySignalQuality() {
		let signalQuality = getSignalQuality()
		if (signalQuality == 1) {
				basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. . . . .\n# . . . .`)
		}
		if (signalQuality == 2) {
				basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. # . . .\n# # . . .`)
		}
		if (signalQuality == 3) {
				basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
		}
		if (signalQuality == 4) {
				basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
		}
		if (signalQuality == 5) {
				basic.showLeds(`. . . . #\n. . . # #\n. . # # #\n. # # # #\n# # # # #`)
		}
	}

	/**
	* return gsm network registration status as code, 1 or 5 mean sucessfull registartion
	*/
	//% weight=100 blockId="getGSMRegistrationStatus"
	//% block="sim7000x GSM registration status" group="2. Status: "
	export function getGSMRegistrationStatus(): number {
			let response = sendATCommand("AT+CREG?")
			let registrationStatusCode = -1;
			if (response.includes("+CREG:")) {
				response = response.split(",")[1]
				registrationStatusCode = parseInt(response.split("\r\n")[0])

			}
			return registrationStatusCode
	}

	/**
	*  Send sms message
	*  Phone number must be in format: "+(country code)(9-digit phone number)" eg. +48333222111
	*/
	//% weight=100 blockId="sendSmsMessage"
	//% block="sim7000x Send SMS message to: %phone_num, content: %content " group="3. GSM: "
	export function sendSmsMessage(phone_num: string, content: string) {
			sendATCommand("AT+CMGF=1") // set text mode
			sendATCommand('AT+CMGS="' + phone_num + '"')
			sendATCommand(content + "\x1A")
			USBSerialLog("Sent SMS message",1)
	}


	/**
	* Handle received SMS message
	*/
	//% weight=100 blockId="sim7000SMSMessageReceived"
	//% block="sim7000x on SMS received" group="3. GSM: "
	//% draggableParameters
	export function smsMessageReceived(handler: (fromNumber: string, message: string) => void) {
		smsReceivedHandler = handler
	}


	/**
	*get gurrent date and time as string
	*format is "yy/MM/dd,hh:mm:ss±zz"
	*example "10/05/06,00:01:52+08
	*/
	//% weight=100 blockId="getDateAndTime"
	//% block="sim7000x Date And Time" group="3. GSM: "
	export function getDateAndTime(): string {
			sendATCommand("AT+CLTS=1") // enable in case it's not enabled
			let modemResponse=sendATCommand('AT+CCLK?')
			if(modemResponse.includes('+CCLK:')){
				let dateTime=modemResponse.split('"')[1]
				return dateTime
			}
			return "Err"

	}

	//MQTT

	/**
	* Mqtt init
	*/
	//% weight=100 blockId="sim7000MqttInit"
	//% block="sim7000x MQTT init: APNname:%ApnName" group="4. MQTT:"
	export function MqttInit(ApnName: string) {
		apnName = ApnName
		ensureGsmConnection()
		ensureGprsConnection()
	}

	/**
	* MQTT connect
	*/
	//% weight=100 blockId="sim7000InitMQTT"
	//% block="sim7000x MQTT connect BrokerUrl:%brokerUrl brokerPort:%brokerPort clientId:%clientId username:%username passwd:%password" group="4. MQTT:"
	export function MqttConnect(brokerUrl: string, brokerPort: string, clientId: string, username: string, password: string) {
		sendATCommandCheckACK('AT+SMCONF="URL","'+brokerUrl+'","'+brokerPort+'"')
		sendATCommandCheckACK('AT+SMCONF="CLIENTID","'+clientId+'"')
		sendATCommandCheckACK('AT+SMCONF="USERNAME","'+username+'"')
		sendATCommandCheckACK('AT+SMCONF="PASSWORD","'+password+'"')
		USBSerialLog("Establishing MQTT connection",1)
		if(!sendATCommandCheckACK("AT+SMCONN",2)){
			USBSerialLog("MQTT connection failed, retrying...",1)
			sendATCommand("AT+SMDISC") //try to disconnect first if connection failed
			sendATCommandCheckACK("AT+SMCONN",-1) //try to connect second time
		}
		USBSerialLog("MQTT connection established",1)
	}

	/**
	* MQTT publish message
	*/
	//% weight=100 blockId="sim7000MqttPublish"
	//% block="sim7000x MQTT publish topic:%brokerUrl message:%message||qos:%qos retain:%retain" group="4. MQTT:"
	//% qos.defl=1 retain.defl=0 expandableArgumentMode="toggle"
	export function MqttPublish(topic: string, message: string, qos=1, retain=0) {
			let cmd='AT+SMPUB="'+topic+'",' + (message.length) + ','+qos+','+retain
			sendATCommand(cmd,100,true,true)
			basic.pause(100)

			let modemResponse=sendATCommand(message,3000,false,true,1000)

			let tries=0
			while((modemResponse.includes("ERROR") || modemResponse.includes("SMSTATE: 0")) && (!(tries>6)) ){
				USBSerialLog("MQTT publish failed, retrying... attepmt:"+tries,1)
				let modemNetState=sendATCommand("AT+CNACT?",-1)
				let mqttConnectionState=sendATCommand("AT+SMSTATE?",-1)
				if(modemNetState.includes("+CNACT: 0") ){
					//network seem disconnected, try to reinit
					MqttInit(apnName)
					sendATCommandCheckACK("AT+SMCONN")
				}
				if(mqttConnectionState.includes("+SMSTATE: 0")){
					//seem like mqtt disconnection,try to reconnect
					sendATCommand("AT+SMDISC")
					sendATCommandCheckACK("AT+SMCONN")
				}
				//retry message publishing
				sendATCommand(cmd,100)
				modemResponse=sendATCommand(message,5000,false,true)

				tries++
			}
			USBSerialLog('MQTT message on topic: "'+topic+'" published',1)
	}

	/**
	* MQTT subscribe
	*/
	//% weight=100 blockId="sim7000SubscribeMQTT"
	//% block="sim7000x MQTT subscribe topic:%topic" group="4. MQTT:"
	export function MqttSubscribe(topic: string) {
		sendATCommand('AT+SMSUB="'+topic+'",1')
		mqttSubscribeTopics.push(topic)
	}


	/**
	* MQTT on subscription receive
	*/
	//% weight=100 blockId="sim7000SubsMsgReceivedMQTT"
	//% block="sim7000x MQTT on subscribtion received" group="4. MQTT:"
	//% draggableParameters
	export function MqttMessageReceived(handler: (topic: string, message: string) => void) {
		mqttSubscribeHandler = handler
	}


	/**
	* MQTT live object publish message
	*/
	//% weight=100 blockId="sim7000MqttLiveObjectPublish"
	//% block="sim7000x Live object publish stream:%stream, timestamp:%timestamp data:%data" group="4. MQTT:"
	export function LiveObjectPublish(stream: string,timestamp: string, data: string[]) {
		let dataString = ''
		for(let i=0; i<data.length; i++){
	    		dataString+=',"'+i+'":"'+data[i]+'"'
		}

		let liveObjectMsg = '{ "s":"'+stream+'", "v": { "timestamp":"'+timestamp+'"'+dataString+'} }'
		MqttPublish("dev/data",liveObjectMsg)
	}



		/**
		* Http init
		*/
		//% weight=100 blockId="sim7000InitHTTP"
		//% block="sim7000x HTTP init apn:%apnName" group="5. HTTP:"
		export function HttpInit(ApnName: string) {
			sendATCommandCheckACK('AT+SAPBR=3,1,"APN","'+ApnName+'"')
			sendATCommandCheckACK('AT+SAPBR=1,1')
			sendATCommandCheckACK('AT+SAPBR=2,1')
			if(! sendATCommandCheckACK('AT+HTTPINIT') ){
				sendATCommandCheckACK('AT+HTTPTERM')
				sendATCommandCheckACK('AT+HTTPINIT')
			}
		}

		/**
		* Http post
		*/
		//% weight=100 blockId="sim7000HTTPPost"
		//% block="sim7000x HTTP post url:%url data:%data" group="5. HTTP:"
		export function HttpPost(url: string, data: string) {
			sendATCommandCheckACK('AT+HTTPPARA="URL","'+url+'"')
			sendATCommand("AT+HTTPDATA="+data.length+",1000")
			basic.pause(100)
			sendATCommand(data,1000,false)
			sendATCommandCheckACK('AT+HTTPACTION=1')
		}

		/**
		* Google sheet writer connect
		*/
		//% weight=100 blockId="sim7000GSheetWriterInit"
		//% block="sim7000x Google Sheet Writer connect" group="5. HTTP:"
		export function GSheetWriterInit() {
			ensureGsmConnection()
			ensureGprsConnection()
			USBSerialLog("Trying to init Google sheet writer...")
			sendATCommand('AT+SHCONF="HEADERLEN",350')
			sendATCommand('AT+SHCONF="BODYLEN",1024')
			sendATCommand('AT+CSSLCFG="convert",2,"google.cer"')
			sendATCommand('AT+SHSSL=1,"google.cer"')
			sendATCommand('AT+SHCONF="URL","https://script.google.com"')
			sendATCommand('AT+SHCONN')
			USBSerialLog("Google script SSL connection established...")
			httpsConnected=true
		}

		/**
		* Google sheet writer write
		*/
		//% weight=100 blockId="sim7000GSheetWriterWrite"
		//% block="sim7000x Google Sheet Writer send data script id:%scriptId data:%data" group="5. HTTP:"
		export function GSheetWrite(scriptId: string,data: string[]) {
			sendATCommand('AT+SHAHEAD="Content-Type","application/json"')
			let dataString = ""
			for(let i=0; i<data.length; i++){
					dataString+=data[i]
					if(!(i==data.length-1))	dataString+=";";
			}
			let setBodyAtCMD='AT+SHBOD="'+dataString+'",'+dataString.length
			let doPostAtCmd ='AT+SHREQ="macros/s/'+scriptId+'/exec",3';

			let tries = 1
			let response = "ERROR"
			while(response.includes("ERROR") && tries<=5){
				sendATCommand(setBodyAtCMD)
				response = sendATCommand(doPostAtCmd)
				basic.pause(500*tries)
				if(tries==3){
					GSheetWriterInit()
				}
				if(response.includes("OK") || response.isEmpty()){// sometimes this cmd return OK, but data isn't sent because connection was terminated
					basic.pause(1000)
					if(!httpsConnected){ //seem that Connection broke
						USBSerialLog("got disc")
						GSheetWriterInit() //reinit
						sendATCommand(setBodyAtCMD)
						response = sendATCommand(doPostAtCmd)
					}
				}
				tries++

			}
		}

	/**
	* GPS init
	*/
	//% weight=100 blockId="sim7000InitGPS"
	//% block="sim7000x GPS init" group="6. GPS:"
	export function InitGPS() {
		sendATCommandCheckACK("AT+CGNSPWR=1")
	}

	/**
	* GNSS get position
	*/
	//% weight=100 blockId="sim7000GPSPosition"
	//% block="sim7000x GPS get position" group="6. GPS:"
	export function GPSGetPosition(): string {
		let modemResponse=sendATCommand("AT+CGNSINF")
		let position = ""
		while(!modemResponse.includes("+CGNSINF: 1,1")){
			basic.pause(1000)
			modemResponse=sendATCommand("AT+CGNSINF")
		}
	  let tmp=modemResponse.split(",")
		position = tmp[3]+","+tmp[4]
		return position
	}

	/**
	* log debug message using usb serial connection
	*/
	//% weight=100 blockId="sim7000USBSerialLog"
	//% block="USBSerialLog %message"
	//% group="7. Low level  and debug functions:"
	export function USBSerialLog(message: string, level?: number) {
		if(level){
			if(usbLoggingLevel < level){
				return
			}
		}
		basic.pause(10)
		serial.redirectToUSB()
		serial.writeLine(input.runningTime()+": "+message)
		basic.pause(10)
		serial.redirect(sim7000RXPin, sim7000TXPin, sim7000BaudRate)
	}

	/**
	* Send plain AT command to modem and return response from it
	*/
	//% weight=100 blockId="SendATCommand"
	//% block="sim7000x SendATCommand %atCommand || timeout:%timeout"
	//% timeout.defl=1000 expandableArgumentMode="toggle"
	//% group="7. Low level  and debug functions:"
	export function SendATCommand(atCommand: string, timeout?: number): string {
		if(timeout){
			return sendATCommand(atCommand,timeout)
		}else{
			return sendATCommand(atCommand)
		}

	}


}
