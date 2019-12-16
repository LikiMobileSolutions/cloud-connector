/**
 * SIM700x block
 */

//% color=#5042f4 icon="\uf093"
namespace SIM700x {

	let _SIM700TX_Pin=SerialPin.P1
	let _SIM700RX_Pin=SerialPin.P0
	let _SIM700BaudRate=BaudRate.BaudRate115200



	/**
    	* (internal function)
    	*/
	function _SendATCommand(atCommand: string, timeout=1000, useNewLine=true): string {
		serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
	    	serial.setWriteLinePadding(0)
	    	serial.setRxBufferSize(128)
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
	    	}
	    return buffer //timeout exceeded, anyway return buffer
	}

	/**
			* (internal function)
			*/
	function _SendATCommandCheckACK(atCommand: string) {
		let modemResponse = _SendATCommand(atCommand,-1)
		while(modemResponse.includes("ERROR")){
				modemResponse = _SendATCommand(atCommand,-1)
				basic.pause(200)
		}
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
    	* Network init
    	*/
	//% weight=100 blockId="SIM700InitNetwork"
	//% block="SIM700x network init: APNname:%ApnName" group="4. Network:"
	export function InitNetwork(ApnName: string) {

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
		_SendATCommandCheckACK("AT+SMCONN")
	}

	/**
    	* MQTT publish message
    	*/
	//% weight=100 blockId="SIM700MqttPublish"
	//% block="SIM700x MQTT publish topic:%brokerUrl message:%message || qos:%qos retain:%retain" group="4. Network:"
	//% qos.defl=0 retain.defl=0 expandableArgumentMode="toggle"
	export function MqttPublish(topic: string, message: string, qos=0, retain=0) {
		let cmd='AT+SMPUB="'+topic+'",' + message.length + ','+qos+','+retain
		_SendATCommand(cmd,100)
		let modemResponse=_SendATCommand(message,-1,false)

	}

	/**
    	* MQTT live object publish message
    	*/
	//% weight=100 blockId="SIM700MqttLiveObjectPublish"
	//% block="SIM700x Live object publish stream:%stream data:%data" group="4. Network:"
	export function LiveObjectPublish(stream: string, data: string[]) {
		let dataString = ''
		for(let i=0; i<data.length; i++){
	    		dataString+=',"'+i+'":"'+data[i]+'"'

		}

		let liveObjectMsg = '{ "s":"'+stream+'", "v": { "timestamp": "2100-01-01 09:00:00"'+dataString+'} }'
		MqttPublish("dev/data",liveObjectMsg)
	}


	/**
    	*
    	*/
	//% weight=100 blockId="SIM700USBSerialLog"
	//% block="USBSerialLog %message"
	//% group="5. Low level  and debug functions:"
	export function USBSerialLog(message: string) {
		serial.redirectToUSB()
		serial.writeLine(message)
	}

	/**
    	* Send plain AT command to modem and return response from it
    	*/
	//% weight=100 blockId="SendATCommand"
	//% block="SIM700x SendATCommand %atCommand || timeout:%timeout"
	//% timeout.defl=1000 expandableArgumentMode="toggle"
	//% group="5. Low level  and debug functions:"
	export function SendATCommand(atCommand: string, timeout?: number): string {
		if(timeout){
			return _SendATCommand(atCommand,timeout)
		}else{
			return _SendATCommand(atCommand)
		}

	}






}
