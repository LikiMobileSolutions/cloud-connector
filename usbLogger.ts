/**
 * usb logger block
 */

//% color=#202020 icon="\uf15c" block="Usb logger" advanced=true
namespace usbLogger {

    export enum LoggingLevel {
        TRACE = 0, // Could contain full(cmd+response) AT communication
        DEBUG = 1,
        INFO = 2,
        WARN = 3,
        ERROR = 4,
    }

    let usbLoggingLevel = LoggingLevel.INFO;
    let sim7000TxPin = SerialPin.P1;
    let sim7000RxPin = SerialPin.P0;
    let sim7000BaudRate = BaudRate.BaudRate115200;

    export let initialised = false;

    /**
     * Init logger module
     */
    //% weight=100 blockId="usbLoggerInit"
    //% block="Usb logger Init TX: %txPin RX: %rxPin Baud: %baudRate Logging level: %loggingLevel"
    //% txPin.defl=SerialPin.P1 rxPin.defl=SerialPin.P0 baudRate.defl=BaudRate.BaudRate115200
    //% group="1. Setup: "
    export function init(txPin: SerialPin, rxPin: SerialPin, baudRate: BaudRate, loggingLevel?: LoggingLevel) {
        if(initialised){
            log("Logger is already initialised. Overriding")
        }
        sim7000TxPin = txPin;
        sim7000RxPin = rxPin;
        sim7000BaudRate = baudRate;
        usbLoggingLevel = loggingLevel;

        serial.redirect(sim7000RxPin, sim7000TxPin, sim7000BaudRate);
        serial.setWriteLinePadding(0);
        serial.setRxBufferSize(128)

        initialised = true;
    }

    /**
     * Log message using usb serial connection
     */
    //% weight=100 blockId="usbLoggerLog"
    //% block="Log message: %message with level: %level"
    //% group="2. Logging messages:"
    export function log(message: string, messageLevel?: LoggingLevel) {
        if (messageLevel) {
            if (usbLoggingLevel < messageLevel) {
                return
            }
        }
        basic.pause(10);
        serial.redirectToUSB();
        serial.writeLine(input.runningTime() + ": " + message);
        basic.pause(10);
        serial.redirect(sim7000RxPin, sim7000TxPin, sim7000BaudRate)
    }

}
