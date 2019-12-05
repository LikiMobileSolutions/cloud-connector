/**
 * SIM700x block
 */

//% color=#5042f4 icon="\uf093"
namespace SIM700x {
	
	let _SIM700TX_Pin=SerialPin.P1
	let _SIM700RX_Pin=SerialPin.P0

	/**
    	* Define pins to which module is connected(RX, TX referrs to pin names on SIM700x module)
    	*/
	//% weight=100 blockId="SIM700Setup" 
	//% block="SIM700x Setup RX: %SIM700RX_Pin TX: %SIM700TX_Pin"
	//% SIM700TX_Pin.defl=SerialPin.P1 SIM700RX_Pin.defl=SerialPin.P0
	export function Setup(SIM700TX_Pin: SerialPin, SIM700RX_Pin: SerialPin) {
		_SIM700RX_Pin=SIM700RX_Pin
		_SIM700TX_Pin=SIM700TX_Pin
	}
	

	/**
    	* Send plain AT command to modem and return response from it
    	*/
	//% weight=100 blockId="SendATCommand" 
	//% block="SIM700x SendATCommand %atCommand"
	export function SendATCommand(atCommand: string): string {
		serial.redirect(_SIM700RX_Pin,_SIM700TX_Pin,BaudRate.BaudRate115200)
		serial.setWriteLinePadding(0)
		serial.setRxBufferSize(128)
		serial.writeLine(atCommand)
		control.waitMicros(1000)
		return serial.readString()
	}

	/**
    	* get signal strength, returns it in 0-4 range or -1 if something is wrong and signal can't be fetched
    	*/
	//% weight=100 blockId="getSignalQuality" 
	//% block="SIM700x GetSignalQuality"
	export function getSignalQuality(): number {
		let signalStrengthRaw = SendATCommand("AT+CSQ")
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


	//% weight=100 blockId="sendSmsMessage" 
	//% block="SIM700x sendSmsMessage to: %phone_num, content: %content "
	export function sendSmsMessage(phone_num: string, content: string): string {
		let modemResponse=""
		SendATCommand("AT+CMGF=1")
		SendATCommand('AT+CMGS="' + phone_num + '"')
		basic.pause(100)
		modemResponse=SendATCommand(content + "\x1A")
		return modemResponse
	}

    
}
