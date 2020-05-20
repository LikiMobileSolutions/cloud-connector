/**
 * usb logger Microbit block
 */

//% color=#202020 icon="\uf15c" block="Usb logger" advanced=true
namespace usbLogger {

  export enum LoggingLevel {
    TRACE = 0, // Could contain full(cmd+response) AT communication
    DEBUG = 100,
    INFO = 200,
    WARN = 300,
    ERROR = 400,
  }

  function loggingLevelLabel(loggingLevel: LoggingLevel) {
    switch (loggingLevel) {
      case LoggingLevel.TRACE:
        return "TRACE";
        break;
      case LoggingLevel.DEBUG:
        return "DEBUG";
        break;
      case LoggingLevel.INFO:
        return "INFO";
        break;
      case LoggingLevel.WARN:
        return "WARN";
        break;
      case LoggingLevel.ERROR:
        return "ERROR";
        break;
    }
  }

  // TODO https://stackoverflow.com/a/61062698
  // const LoggingLevelLabel: { [key in LoggingLevel]: string } = {
  //   [LoggingLevel.TRACE]: "TRACE",
  //   [LoggingLevel.DEBUG]: "DEBUG",
  //   [LoggingLevel.INFO]: "INFO",
  //   [LoggingLevel.WARN]: "WARN",
  //   [LoggingLevel.ERROR]: "ERROR",
  // };

  let usbLoggingLevel = LoggingLevel.INFO;
  let appTxPin = SerialPin.P0;
  let appRxPin = SerialPin.P1;
  let appBaudRate = BaudRate.BaudRate115200;

  export let initialised = false;

  /**
   * Init logger module
   */
  //% weight=100 blockId="usbLogger.init"
  //% block="Usb logger Init TX: %txPin RX: %rxPin Baud: %baudRate Logging level: %loggingLevel"
  //% txPin.defl=SerialPin.P1 rxPin.defl=SerialPin.P0 baudRate.defl=BaudRate.BaudRate115200
  //% group="1. Setup: "
  export function init(txPin: SerialPin, rxPin: SerialPin, baudRate: BaudRate, loggingLevel?: LoggingLevel) {
    if (initialised) {
      warn(`Logger is already initialised. Overriding`)
    }
    appTxPin = txPin;
    appRxPin = rxPin;
    appBaudRate = baudRate;
    usbLoggingLevel = loggingLevel;

    serial.redirect(appTxPin, appRxPin, appBaudRate);
    serial.setWriteLinePadding(0);
    serial.setRxBufferSize(128)

    initialised = true;
  }

  /**
   * Log message using usb serial connection
   */
  //% weight=100 blockId="usbLogger.log"
  //% block="Log message: %message with level: %level"
  //% group="2. Logging messages:"
  export function log(message: string, messageLevel: LoggingLevel) {
    if (messageLevel != null && messageLevel < usbLoggingLevel) {
      return
    }

    basic.pause(10);
    serial.redirectToUSB();
    serial.writeLine(`${input.runningTime()}\t${loggingLevelLabel(messageLevel)}\t: ${message}`);
    basic.pause(10);
    serial.redirect(appTxPin, appRxPin, appBaudRate)
  }

  export function trace(message: string) {
    log(message, LoggingLevel.TRACE);
  }

  export function debug(message: string) {
    log(message, LoggingLevel.DEBUG);
  }

  export function info(message: string) {
    log(message, LoggingLevel.INFO);
  }

  export function warn(message: string) {
    log(message, LoggingLevel.WARN);
  }

  export function error(message: string) {
    log(message, LoggingLevel.ERROR);
  }

}
