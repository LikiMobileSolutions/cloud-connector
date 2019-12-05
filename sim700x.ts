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
	function _SendATCommand(atCommand: string, timeout=100): string {
		serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
	    	serial.setWriteLinePadding(0)
	    	serial.setRxBufferSize(128)
	    	serial.writeLine(atCommand)

	    	let startTs = input.runningTime()
	    	let buffer = ""
	    	while (input.runningTime() - startTs <= timeout) { //read until timeout is not exceeded
			buffer += serial.readString()
			if (buffer.includes("OK") || buffer.includes("ERROR")) { //command completed, modem responded
		    		return buffer
			}
	    	}
	    return buffer //timeout exceeded, anyway return buffer
	}
	

	/**
    	* Define pins to which module is connected(RX, TX referrs to pin names on SIM700x module)
    	*/
	//% weight=100 blockId="SIM700Setup" 
	//% block="SIM700x Setup RX: %SIM700RX_Pin TX: %SIM700TX_Pin Baud:%SIM700BaudRate"
	//% SIM700TX_Pin.defl=SerialPin.P1 SIM700RX_Pin.defl=SerialPin.P0 SIM700BaudRate.defl=BaudRate.BaudRate115200 group="1. Setup: "
	export function Setup(SIM700TX_Pin: SerialPin, SIM700RX_Pin: SerialPin, SIM700BaudRate: BaudRate) {
		_SIM700RX_Pin=SIM700RX_Pin
		_SIM700TX_Pin=SIM700TX_Pin
		_SIM700BaudRate=SIM700BaudRate
	}
	
	/**
    	* 
    	*/
	//% weight=100 blockId="SIM700USBSerialLog" 
	//% block="USBSerialLog %message"
	//% group="4. Low level  and debug functions:"
	export function USBSerialLog(message: string) {
		serial.redirectToUSB()
		serial.writeLine(message)
	}

	/**
    	* Send plain AT command to modem and return response from it
    	*/
	//% weight=100 blockId="SendATCommand" 
	//% block="SIM700x SendATCommand %atCommand"
	//% group="4. Low level  and debug functions:"
	export function SendATCommand(atCommand: string): string {
		return _SendATCommand(atCommand)
	}

	/**
    	* Check if module is up and responding properly to AT command
    	*/
	//% weight=100 blockId="isPoweredOn" 
	//% block="SIM700x isPoweredOn" group="2. Status: "
	export function isPoweredOn(): boolean {
		let atResponse = _SendATCommand("AT")
		if(atResponse.includes("AT") && atResponse.includes("OK")){
			return true;
		}else{
			return false;
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
    	* Check registration status,
	* return gsm network registration status as string
    	*/
	//% weight=100 blockId="getGSMRegistrationStatus" 
	//% block="SIM700x GetGSMRegistrationStatus" group="2. Status: "
	export function getGSMRegistrationStatus(): string {
		let response = _SendATCommand("AT+CREG?")
		let registrationStatusCode = -1;
		let registartionStatusString="error, check connections and power supply";
		if (response.includes("+CREG:")) {
			response = response.split(",")[1]
			registrationStatusCode = parseInt(response.split("\r\n")[0])
			switch(registrationStatusCode){
				case (0):
					registartionStatusString="not registered and not searching currently"
					break
				case (1):
					registartionStatusString="registered and ready"
					break
				case (2):
					registartionStatusString="not registered, searching..."
					break
				case (3):
					registartionStatusString="registration denied"
					break
				case (4):
					registartionStatusString="unknown"
					break
				case (5):
					registartionStatusString="registered, roaming"
					break
				case (6):
					registartionStatusString="registered for sms only"
					break
				default:
					registartionStatusString="registration, code not defined: "+registrationStatusCode
			}
		}
		return registartionStatusString
	}


	/**
    	*  Send sms message
	*  Phone number must be in format: "+(country code)(9-digit phone number)" eg. +48333222111
    	*/
	//% weight=100 blockId="sendSmsMessage" 
	//% block="SIM700x sendSmsMessage to: %phone_num, content: %content " group="3. GSM: "
	export function sendSmsMessage(phone_num: string, content: string) {
		SendATCommand("AT+CMGF=1") // set text mode
		SendATCommand('AT+CMGS="' + phone_num + '"') 
		SendATCommand(content + "\x1A")
	}

    
}
