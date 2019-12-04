//% color=#5042f4 icon="\uf2c9"
namespace SIM700x {

    //% weight=10 blockId="SendATCommand" 
    //% block="Send AT Command %atCommand"
    //% shim=DS18B20::Temperature
    export function Temperature(atCommand: string): string {
        // Fake function for simulator
        return "test"
    }
    
    
}
