/**
 * SIM700x block
 */

//% color=#5042f4 icon="\f012"
namespace SIM700x {

    //% weight=100 blockId="SendATCommand" 
    //% block="SendATCommand %atCommand"
    export function SendATCommand(atCommand: string): string {
        serial.redirect(SerialPin.P0,SerialPin.P1,BaudRate.BaudRate115200)
        serial.setWriteLinePadding(0)
        serial.setRxBufferSize(128)
        serial.writeLine(atCommand)
        control.waitMicros(1000)
        return serial.readString()
    }
    
    
}
