/**
 * SIM700x block
 */

//% color=#5042f4 icon="\f012"
namespace SIM700x {

    //% weight=100 blockId="SendATCommand" 
    //% block="SIM700x SendATCommand %atCommand"
    export function SendATCommand(atCommand: string): string {
        serial.redirect(SerialPin.P0,SerialPin.P1,BaudRate.BaudRate115200)
        serial.setWriteLinePadding(0)
        serial.setRxBufferSize(128)
        serial.writeLine(atCommand)
        control.waitMicros(1000)
        return serial.readString()
    }

    //% weight=100 blockId="getSignalQuality" 
    //% block="SIM700x GetSignalQuality"
    export function getSignalQuality(): number {
        let signalStrengthRaw = SendATCommand("AT+CSQ")
	let signalStrengthLevel = -1
    	if (signalStrengthRaw.includes("+CSQ:")) {
		signalStrengthRaw = signalStrengthRaw.split(": ")[1]
		signalStrengthRaw = signalStrengthRaw.split(",")[0]
		signalStrengthLevel = Math.round(Math.map(parseInt(signalStrengthRaw), 0, 31, 0, 4))
	
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
