/**
 * SIM700x block
 */

//% color=#5042f4 icon="\uf093"
namespace SIM700x {

	let _SIM700TX_Pin=SerialPin.P1
	let _SIM700RX_Pin=SerialPin.P0
	let _SIM700BaudRate=BaudRate.BaudRate115200

	let _Apn_name=""

	/**
	* (internal function)
	*/
	function _SendATCommand(atCommand: string, timeout=1000, useNewLine=true): string {
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
		  		return buffer
				}


				if(!buffer.isEmpty()){ //there's something in buffer, wait, read one more time and return
					basic.pause(100)
					buffer += serial.readString()
					return buffer
				}

			}
		return buffer //timeout exceeded, anyway return buffer
	}

	/**
	* (internal function)
	*/
	function _SendATCommandCheckACK(atCommand: string, limit=5): boolean {
			let tries=0
			let modemResponse = _SendATCommand(atCommand,-1)
			while(!modemResponse.includes("OK")){
					if(tries>limit){
						return false
					}
					modemResponse = _SendATCommand(atCommand,-1)
					basic.pause(100*tries) //adaptively extend pause during sending commands which fail
					tries++

			}
			return true
	}

	/**
	* Init module
	*/
	//% weight=100 blockId="SIM700Init"
	//% block="SIM700x Init RX: %SIM700RX_Pin TX: %SIM700TX_Pin Baud:%SIM700BaudRate"
	//% SIM700TX_Pin.defl=SerialPin.P1 SIM700RX_Pin.defl=SerialPin.P0 SIM700BaudRate.defl=BaudRate.BaudRate115200 group="1. Setup: "
	export function Init(SIM700TX_Pin: SerialPin, SIM700RX_Pin: SerialPin, SIM700BaudRate: BaudRate) {
			_SIM700RX_Pin=SIM700RX_Pin
			_SIM700TX_Pin=SIM700TX_Pin
			_SIM700BaudRate=SIM700BaudRate

			serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
			serial.setWriteLinePadding(0)
			serial.setRxBufferSize(128)

			let atResponse = _SendATCommand("AT")
			let checks=0
			while( !(atResponse.includes("AT") && atResponse.includes("OK")) ){ //check in loop if echo is enabled
				_SendATCommand("ATE 1")
				atResponse = _SendATCommand("AT",1000)
				if(checks>=10){
					break;
				}
				checks++
			}
	}

	/**
	* get signal strength,
	* return in 0-4 range
	* return -1 if something is wrong and signal can't be fetched
	*/
	//% weight=100 blockId="getSignalQuality"
	//% block="SIM700x GetSignalQuality" group="2. Status: "
	export function getSignalQuality(): number {
			let signalStrengthRaw = _SendATCommand("AT+CSQ")
			let signalStrengthLevel = -1
			if (signalStrengthRaw.includes("+CSQ:")) {
				signalStrengthRaw = signalStrengthRaw.split(": ")[1]
				signalStrengthRaw = signalStrengthRaw.split(",")[0]
				if(parseInt(signalStrengthRaw) != 99){ // 99 means that signal can't be fetched
					signalStrengthLevel = Math.round(Math.map(parseInt(signalStrengthRaw), 0, 31, 0, 4))
				}
			}
			return signalStrengthLevel
	}


	/**
	* return gsm network registration status as code, 1 or 5 mean sucessfull registartion
	*/
	//% weight=100 blockId="getGSMRegistrationStatus"
	//% block="SIM700x GetGSMRegistrationStatus" group="2. Status: "
	export function getGSMRegistrationStatus(): number {
			let response = _SendATCommand("AT+CREG?")
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
	//% block="SIM700x sendSmsMessage to: %phone_num, content: %content " group="3. GSM: "
	export function sendSmsMessage(phone_num: string, content: string) {
			_SendATCommand("AT+CMGF=1") // set text mode
			_SendATCommand('AT+CMGS="' + phone_num + '"')
			_SendATCommand(content + "\x1A")
	}

	/**
	*get gurrent date and time as string
	*format is "yy/MM/dd,hh:mm:ss±zz"
	*example "10/05/06,00:01:52+08
	*/
	//% weight=100 blockId="getDateAndTime"
	//% block="SIM700x getDateAndTime" group="3. GSM: "
	export function getDateAndTime(): string {
			_SendATCommand("AT+CLTS=1") // enable in case it's not enabled
			let modemResponse=_SendATCommand('AT+CCLK?')
			if(modemResponse.includes('+CCLK:')){
				let dateTime=modemResponse.split('"')[1]
				return dateTime
			}
			return "Err"

	}


	/**
	* Network init
	*/
	//% weight=100 blockId="SIM700InitNetwork"
	//% block="SIM700x network init: APNname:%ApnName" group="4. Network:"
	export function InitNetwork(ApnName: string) {
		_Apn_name = ApnName
		let gsmStatus=getGSMRegistrationStatus()
		while(!(gsmStatus==1 || gsmStatus==5)){
			gsmStatus=getGSMRegistrationStatus()
			basic.pause(500)
		}
		_SendATCommand('AT+CNACT=1,"'+ApnName+'"')
		basic.pause(1000)
		let netStatus=_SendATCommand('AT+CNACT?')
		let tries = 0
		while(!netStatus.includes("+CNACT: 1")){
			if(tries>=8){
				_SendATCommand('AT+CNACT=1,"'+ApnName+'"')
				tries=0
			}
			basic.pause(1000)
			netStatus=_SendATCommand('AT+CNACT?')
			tries++
		}
	}

	/**
	* MQTT init
	*/
	//% weight=100 blockId="SIM700InitMQTT"
	//% block="SIM700x MQTT init BrokerUrl:%brokerUrl brokerPort:%brokerPort clientId:%clientId username:%username passwd:%password" group="4. Network:"
	export function InitMQTT(brokerUrl: string, brokerPort: string, clientId: string, username: string, password: string) {
		_SendATCommandCheckACK('AT+SMCONF="URL","'+brokerUrl+'","'+brokerPort+'"')
		_SendATCommandCheckACK('AT+SMCONF="CLIENTID","'+clientId+'"')
		_SendATCommandCheckACK('AT+SMCONF="USERNAME","'+username+'"')
		_SendATCommandCheckACK('AT+SMCONF="PASSWORD","'+password+'"')
		if(! _SendATCommandCheckACK("AT+SMCONN",2)){
			_SendATCommand("AT+SMDISC") //try to disconnect first if connection failed
			_SendATCommandCheckACK("AT+SMCONN") //try to connect second time
		}
	}

	/**
	* MQTT publish message
	*/
	//% weight=100 blockId="SIM700MqttPublish"
	//% block="SIM700x MQTT publish topic:%brokerUrl message:%message || qos:%qos retain:%retain" group="4. Network:"
	//% qos.defl=0 retain.defl=0 expandableArgumentMode="toggle"
	export function MqttPublish(topic: string, message: string, qos=2, retain=0) {
			let cmd='AT+SMPUB="'+topic+'",' + message.length + ','+qos+','+retain
			_SendATCommand(cmd,100)
			let modemResponse=_SendATCommand(message,3000,false)

			if(modemResponse.includes("ERROR")){
				let tries=0
				while(modemResponse.includes("ERROR") && (!(tries>3)) ){
					let modemNetState=_SendATCommand("AT+CNACT?",-1)
					if(modemNetState.includes("+CNACT: 1") ){
						//network seem fine, try to reconnect mqtt
						_SendATCommand("AT+SMDISC",-1)
						_SendATCommand("AT+SMCONN",-1)
					}else{
						//seem like a network problem, try to re-init
						InitNetwork(_Apn_name)
					}
					//retry message publishing
					_SendATCommand(cmd,100)
					modemResponse=_SendATCommand(message,5000,false)

					tries++
				}
			}


	}

	/**
	* MQTT live object publish message
	*/
	//% weight=100 blockId="SIM700MqttLiveObjectPublish"
	//% block="SIM700x Live object publish stream:%stream, timestamp:%timestamp data:%data" group="4. Network:"
	export function LiveObjectPublish(stream: string,timestamp: string, data: string[]) {
		let dataString = ''
		for(let i=0; i<data.length; i++){
	    		dataString+=',"'+i+'":"'+data[i]+'"'

		}

		let liveObjectMsg = '{ "s":"'+stream+'", "v": { "timestamp":"'+timestamp+'"'+dataString+'} }'
		MqttPublish("dev/data",liveObjectMsg)
	}


	/**
	* GPS init
	*/
	//% weight=100 blockId="SIM700InitGPS"
	//% block="SIM700x GPS init" group="5. GPS:"
	export function InitGPS() {
		_SendATCommandCheckACK("AT+CGNSPWR=1")
	}

	/**
	* GNSS get position
	*/
	//% weight=100 blockId="SIM700GPSPosition"
	//% block="SIM700x GPS get position" group="5. GPS:"
	export function GPSGetPosition(): string {
		let modemResponse=_SendATCommand("AT+CGNSINF")
		let position = ""
		while(!modemResponse.includes("+CGNSINF: 1,1")){
			basic.pause(500)
			modemResponse=_SendATCommand("AT+CGNSINF")
		}
	  let tmp=modemResponse.split(",")
		position = tmp[3]+","+tmp[4]
		return position
	}

	/**
	* log debug message using usb serial connection
	*/
	//% weight=100 blockId="SIM700USBSerialLog"
	//% block="USBSerialLog %message"
	//% group="7. Low level  and debug functions:"
	export function USBSerialLog(message: string) {
		serial.redirectToUSB()
		serial.writeLine(message)
		serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
	}

	/**
	* Send plain AT command to modem and return response from it
	*/
	//% weight=100 blockId="SendATCommand"
	//% block="SIM700x SendATCommand %atCommand || timeout:%timeout"
	//% timeout.defl=1000 expandableArgumentMode="toggle"
	//% group="7. Low level  and debug functions:"
	export function SendATCommand(atCommand: string, timeout?: number): string {
		if(timeout){
			return _SendATCommand(atCommand,timeout)
		}else{
			return _SendATCommand(atCommand)
		}

	}


}
