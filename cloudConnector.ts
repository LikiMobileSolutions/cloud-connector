/**
 * Liki Cloud Connector Microbit block
 */

//% color=#179600 icon="\uf093" block="Cloud Connector"
namespace cloudConnector {
  //network APN name, defined by user in initialization of network functions
  let actualApnName = "internet";

  //switches for debug purposes
  let echoEnabled = false; //should be alsways on false during normal operation

  //signal quality report variables
  const csqMinInterval = 3000;
  let lastCsqTs = 0;
  let lastCsqValue = 0;

  //Default handler functions
  let smsReceivedHandler = function (fromNumber: string, message: string) {
    usbLogger.warn(`Got SMS form ${fromNumber} but SMS received handler is not implemented!`
        + `Skipping message ${message}`);
  };
  let mqttSubscribeHandler = function (topic: string, message: string) {
    usbLogger.warn(`Subscribed for MQTT topic "${topic}" but MQTT subscribe handler is not implemented! `
        + `Skipping message ${message}`);
  };
  let mqttSubscribeTopics: string[] = [];

  let httpsConnected = false;
  let requestFailed = false;

  /**
   * (internal function)
   */
  function doSendAtCommand(atCommand: string, timeout = 1000, useNewLine = true, forceLogDisable = false, additionalWaitTime = 0): string {
    serial.readString(); //way to empty buffer
    if (useNewLine) {
      serial.writeLine(atCommand)
    } else {
      serial.writeString(atCommand)
    }

    let startTs = input.runningTime();
    let buffer = "";

    while ((input.runningTime() - startTs <= timeout) || (timeout == -1)) { //read until timeout is not exceeded
      buffer += serial.readString();
      if (buffer.includes("OK") || buffer.includes("ERROR")) { //command completed, modem responded
        break
      }
    }

    if (additionalWaitTime > 0) {
      basic.pause(additionalWaitTime);
      buffer += serial.readString()
    }

    if (!forceLogDisable) { //for criticial AT command usb logging should be disabled, due to stability issues
      usbLogger.trace(`Command: ${atCommand}\r\nResponse: ${buffer}`);
    }
    return buffer
  }

  /**
   * (internal function)
   */
  function sendAtCommandCheckAck(atCommand: string, limit = 5): boolean {
    let tries = 0;
    let modemResponse = doSendAtCommand(atCommand, -1);
    while (!modemResponse.includes("OK")) {
      if (tries > limit) {
        return false
      }
      modemResponse = doSendAtCommand(atCommand, -1);
      basic.pause(100 * tries); //adaptively extend pause during sending commands which fail
      tries++

    }
    return true
  }

  /**
   * (internal function)
   */
  function setupHandlers() {
    //attach listener
    usbLogger.info(`Handlers init...`);
    if (!echoEnabled) { //In case echo is enabled handlers will not work!
      serial.onDataReceived("+", function () {
        basic.pause(50);
        let dataRaw = serial.readString();
        let data = dataRaw.substr(dataRaw.indexOf("+"), dataRaw.length);

        if (data.includes("SMSUB:")) { //MQTT subscription received
          for (let i = 0; i < mqttSubscribeTopics.length; i++) {
            if (data.includes(mqttSubscribeTopics[i])) {
              let message = (data.split('","')[1]); // extract message from AT Response
              usbLogger.info(`MQTT subscription on topic: "${mqttSubscribeTopics[i]}" received content:"${message.slice(0, -3)}"`);
              mqttSubscribeHandler(mqttSubscribeTopics[i], message.slice(0, -3))
            }
          }
        } else if (data.includes("CMTI:")) { //SMS received
          let msgId = cloudConnectorUtils.trimString(data.split(",")[1]);
          let smsRaw = doSendAtCommand("AT+CMGR=" + msgId);
          let smsContent = cloudConnectorUtils.trimString(smsRaw.split("\n")[2]);
          let smsHeader = smsRaw.split("\n")[1];
          let senderPhoneNum = (smsHeader.split(","))[1];
          senderPhoneNum = senderPhoneNum.slice(1, senderPhoneNum.length - 1);
          usbLogger.info(`Received SMS with id: ${msgId}, message: ${smsContent}`);
          smsReceivedHandler(senderPhoneNum, smsContent);
          doSendAtCommand("AT+CMGD=0,1") // delete readed message, to prevent memory exhaustion
        } else if (data.includes("SHREQ:")) {
          let dataSplit = data.split(",");
          let responseCode = dataSplit[1];
          let responseLength = dataSplit[2];
          usbLogger.info(`Got http response. Code: ${responseCode}, content length: ${responseLength}`);
          if (responseLength.includes("700")) { //this actually means error
            requestFailed = true;
            usbLogger.error(`Request failed`)
          } else if (responseLength.includes("680")) { //this is fine
            requestFailed = false
          }
        } else if (data.includes("SHSTATE: 0")) {
          usbLogger.info(`Https connection broke`);
          httpsConnected = false
        }
      })
    }
  }

  /**
   * (internal function)
   */
  function ensureGsmConnection() {
    let gsmStatus = gsmRegistrationStatus();
    while (!(gsmStatus == 1 || gsmStatus == 5)) {
      gsmStatus = gsmRegistrationStatus();
      basic.pause(500);
      usbLogger.info(`Waiting for GSM network. GSM status was ${gsmStatus}`)
    }
  }


  /**
   * (internal function)
   */
  function ensureGprsConnection() {
    doSendAtCommand('AT+CNACT=1,"' + actualApnName + '"');
    basic.pause(1000);
    let netStatus = doSendAtCommand('AT+CNACT?');
    let tries = 0;
    while (!netStatus.includes("+CNACT: 1")) {
      if (tries >= 8) {
        doSendAtCommand('AT+CNACT=1,"' + actualApnName + '"');
        tries = 0
      }
      basic.pause(1000);
      usbLogger.info(`Waiting for GPRS network connection`);
      netStatus = doSendAtCommand('AT+CNACT?');
      tries++
    }
  }

  /**
   * Init module
   */
  //% weight=100 blockId="cloudConnector.init"
  //% block="init cloud connector"
  //% group="1. Setup: "
  export function init() {
    initLoggerIfNotInitialised();

    let atResponse = doSendAtCommand("AT");
    while (!atResponse.includes("OK")) { //check in loop if echo is enabled
      atResponse = doSendAtCommand("AT", 1000);
      usbLogger.info(`Trying to comunicate with modem...`)
    }
    doSendAtCommand("ATE " + (echoEnabled ? "1" : "0"));
    doSendAtCommand("AT+CMEE=2"); // extend error logging
    doSendAtCommand("AT+CMGF=1"); // sms message text mode
    doSendAtCommand("AT+CMGD=0,4"); // delete all sms messages
    setupHandlers();
    usbLogger.info(`Init done...`)
  }

  function initLoggerIfNotInitialised() {
    if (!usbLogger.initialised) {
      usbLogger.init(SerialPin.P8, SerialPin.P16, BaudRate.BaudRate115200, usbLogger.LoggingLevel.INFO)
    }
  }

  /**
   * get signal strength,
   * return in 1-5 range
   * return -1 if something is wrong and signal can't be fetched
   */
  //% weight=100 blockId="cloudConnector.signalQuality"
  //% block="GSM signal quality"
  //% group="2. Status: "
  export function signalQuality(): number {
    if (input.runningTime() - lastCsqTs > csqMinInterval) {
      let signalStrengthRaw = doSendAtCommand("AT+CSQ");
      let signalStrengthLevel = -1;
      if (signalStrengthRaw.includes("+CSQ:")) {
        signalStrengthRaw = signalStrengthRaw.split(": ")[1];
        signalStrengthRaw = signalStrengthRaw.split(",")[0];
        if (parseInt(signalStrengthRaw) != 99) { // 99 means that signal can't be fetched
          signalStrengthLevel = Math.round(Math.map(parseInt(signalStrengthRaw), 0, 31, 1, 5))
        }
      }
      lastCsqTs = input.runningTime();
      lastCsqValue = signalStrengthLevel
    }
    return lastCsqValue
  }

  /**
   * Display signal strength on led matrix
   */
  //% weight=100 blockId="cloudConnector.displaySignalQuality"
  //% block="dispaly GSM signal quality"
  //% group="2. Status: "
  export function displaySignalQuality() {
    let signalQualityVal = signalQuality();
    if (signalQualityVal == 1) {
      basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. . . . .\n# . . . .`)
    }
    if (signalQualityVal == 2) {
      basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. # . . .\n# # . . .`)
    }
    if (signalQualityVal == 3) {
      basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
    }
    if (signalQualityVal == 4) {
      basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
    }
    if (signalQualityVal == 5) {
      basic.showLeds(`. . . . #\n. . . # #\n. . # # #\n. # # # #\n# # # # #`)
    }
  }

  /**
   * return gsm network registration status as code, 1 or 5 mean sucessfull registartion
   */
  //% weight=100 blockId="cloudConnector.gsmRegistrationStatus"
  //% block="GSM registration status"
  //% group="2. Status: "
  export function gsmRegistrationStatus(): number {
    let response = doSendAtCommand("AT+CREG?");
    let registrationStatusCode = -1;
    if (response.includes("+CREG:")) {
      response = response.split(",")[1];
      registrationStatusCode = parseInt(response.split("\r\n")[0])
    }
    return registrationStatusCode
  }

  /**
   *  Send sms message
   *  Phone number must be in format: "+(country code)(9-digit phone number)"
   *  example +48333222111
   */
  //% weight=100 blockId="cloudConnector.sendSmsMessage"
  //% block="send SMS message to: %phoneNumber, with content: %content"
  //% group="3. GSM: "
  export function sendSmsMessage(phoneNumber: string, content: string) {
    doSendAtCommand("AT+CMGF=1"); // set text mode
    doSendAtCommand('AT+CMGS="' + phoneNumber + '"');
    doSendAtCommand(content + "\x1A");
    usbLogger.info(`Sent SMS message`)
  }


  /**
   * Handle received SMS message
   */
  //% weight=100 blockId="cloudConnector.onSmsReceived"
  //% block="on SMS received from $senderNumber with $message"
  //% group="3. GSM: "
  //% draggableParameters
  export function onSmsReceived(handler: (senderNumber: string, message: string) => void) {
    smsReceivedHandler = handler
  }


  /**
   * get current date and time as string or null
   * format is "yy/MM/dd,hh:mm:ss±zz"
   * example 10/05/06,00:01:52+08
   */
  //% weight=100 blockId="cloudConnector.dateAndTime"
  //% block="date and time"
  //% group="3. GSM: "
  export function dateAndTime(): string {
    doSendAtCommand("AT+CLTS=1"); // enable in case it's not enabled
    let modemResponse = doSendAtCommand('AT+CCLK?');
    if (modemResponse.includes('+CCLK:')) {
      return modemResponse.split('"')[1]
    }
    return null
  }

  //MQTT

  /**
   * Mqtt init
   */
  //% weight=100 blockId="cloudConnector.initMqtt"
  //% block="init MQTT with APN name: %apnName"
  //% group="4. MQTT:"
  export function initMqtt(apnName: string) {
    actualApnName = apnName;
    ensureGsmConnection();
    ensureGprsConnection()
  }

  /**
   * MQTT connect
   */
  //% weight=100 blockId="cloudConnector.connectToMqtt"
  //% block="connect to MQTT with |broker url:%brokerUrl broker port:%brokerPort client id:%clientId username:%username password:%password"
  //% group="4. MQTT:"
  export function connectToMqtt(brokerUrl: string, brokerPort: string, clientId: string, username: string, password: string) {
    sendAtCommandCheckAck('AT+SMCONF="URL","' + brokerUrl + '","' + brokerPort + '"');
    sendAtCommandCheckAck('AT+SMCONF="CLIENTID","' + clientId + '"');
    sendAtCommandCheckAck('AT+SMCONF="USERNAME","' + username + '"');
    sendAtCommandCheckAck('AT+SMCONF="PASSWORD","' + password + '"');
    usbLogger.info(`Establishing MQTT connection`);
    if (!sendAtCommandCheckAck("AT+SMCONN", 2)) {
      usbLogger.info(`MQTT connection failed, retrying...`);
      doSendAtCommand("AT+SMDISC"); //try to disconnect first if connection failed
      sendAtCommandCheckAck("AT+SMCONN", -1) //try to connect second time
    }
    usbLogger.info(`MQTT connection established`)
  }

  /**
   * MQTT publish message
   */
  //% weight=100 blockId="cloudConnector.publishOnMqtt"
  //% block="publish on MQTT topic:%topic message:%message||qos:%qos retain:%retain"
  //% group="4. MQTT:"
  //% qos.defl=1 retain.defl=0 expandableArgumentMode="toggle"
  export function publishOnMqtt(topic: string, message: string, qos = 1, retain = 0) {
    let cmd = 'AT+SMPUB="' + topic + '",' + (message.length) + ',' + qos + ',' + retain;
    doSendAtCommand(cmd, 100, true, true);
    basic.pause(100);

    let modemResponse = doSendAtCommand(message, 3000, false, true, 1000);

    let tries = 0;
    while ((modemResponse.includes("ERROR") || modemResponse.includes("SMSTATE: 0")) && (!(tries > 6))) {
      usbLogger.info(`MQTT publish failed, retrying... attepmt: ${tries}`);
      let modemNetState = doSendAtCommand("AT+CNACT?", -1);
      let mqttConnectionState = doSendAtCommand("AT+SMSTATE?", -1);
      if (modemNetState.includes("+CNACT: 0")) {
        //network seem disconnected, try to reinit
        initMqtt(actualApnName);
        sendAtCommandCheckAck("AT+SMCONN")
      }
      if (mqttConnectionState.includes("+SMSTATE: 0")) {
        //seem like mqtt disconnection,try to reconnect
        doSendAtCommand("AT+SMDISC");
        sendAtCommandCheckAck("AT+SMCONN")
      }
      //retry message publishing
      doSendAtCommand(cmd, 100);
      modemResponse = doSendAtCommand(message, 5000, false, true);

      tries++
    }
    usbLogger.info(`MQTT message on topic: "${topic}" published`)
  }

  /**
   * MQTT subscribe
   */
  //% weight=100 blockId="cloudConnector.subscribeToMqtt"
  //% block="subscribe to MQTT topic:%topic"
  //% group="4. MQTT:"
  export function subscribeToMqtt(topic: string) {
    doSendAtCommand('AT+SMSUB="' + topic + '",1');
    mqttSubscribeTopics.push(topic)
  }


  /**
   * MQTT on subscription receive
   */
  //% weight=100 blockId="cloudConnector.onMqttMessageReceived"
  //% block="on MQTT $topic subscribtion with $message received"
  //% group="4. MQTT:"
  //% draggableParameters
  export function onMqttMessageReceived(handler: (topic: string, message: string) => void) {
    mqttSubscribeHandler = handler
  }


  /**
   * MQTT Live Objects publish message
   */
  //% weight=100 blockId="cloudConnector.publishOnLiveObjects"
  //% block="publish data:%data with timestamp:%timestamp into Live Objects stream:%stream"
  //% group="4. MQTT:"
  export function publishIntoLiveObjects(data: string[], timestamp: string, stream: string) {
    let dataString = '';
    for (let i = 0; i < data.length; i++) {
      dataString += ',"' + i + '":"' + data[i] + '"'
    }

    let liveObjectMsg = '{ "s":"' + stream + '", "v": { "timestamp":"' + timestamp + '"' + dataString + '} }';
    publishOnMqtt("dev/data", liveObjectMsg)
  }


  /**
   * Http init
   */
  //% weight=100 blockId="cloudConnector.initHttp"
  //% block="init HTTP with APN name:%apnName"
  //% group="5. HTTP:"
  export function initHttp(apnName: string) {
    // TODO do we have to save apnName as actualApnName here?
    sendAtCommandCheckAck('AT+SAPBR=3,1,"APN","' + apnName + '"');
    sendAtCommandCheckAck('AT+SAPBR=1,1');
    sendAtCommandCheckAck('AT+SAPBR=2,1');
    if (!sendAtCommandCheckAck('AT+HTTPINIT')) {
      sendAtCommandCheckAck('AT+HTTPTERM');
      sendAtCommandCheckAck('AT+HTTPINIT')
    }
  }

  /**
   * Http post
   */
  //% weight=100 blockId="cloudConnector.httpPost"
  //% block="post data:%data through HTTP to url:%url"
  //% group="5. HTTP:"
  export function httpPost(data: string, url: string) {
    sendAtCommandCheckAck('AT+HTTPPARA="URL","' + url + '"');
    doSendAtCommand("AT+HTTPDATA=" + data.length + ",1000");
    basic.pause(100);
    doSendAtCommand(data, 1000, false);
    sendAtCommandCheckAck('AT+HTTPACTION=1')
  }

  /**
   * initialise Google Sheet connection
   */
  //% weight=100 blockId="cloudConnector.initGoogleSheetWriter"
  //% block="init Google Sheet connection"
  //% group="5. HTTP:"
  export function initGoogleSheetWriter() {
    ensureGsmConnection();
    ensureGprsConnection();
    usbLogger.info(`Trying to init Google sheet writer...`);
    doSendAtCommand('AT+SHCONF="HEADERLEN",350');
    doSendAtCommand('AT+SHCONF="BODYLEN",1024');
    doSendAtCommand('AT+CSSLCFG="convert",2,"google.cer"');
    doSendAtCommand('AT+SHSSL=1,"google.cer"');
    doSendAtCommand('AT+SHCONF="URL","https://script.google.com"');
    doSendAtCommand('AT+SHCONN');
    usbLogger.info(`Google script SSL connection established...`);
    httpsConnected = true
  }

  /**
   * write to Google Sheet using script
   */
  //% weight=100 blockId="cloudConnector.writeToGoogleSheet"
  //% block="send data:%data to Google Sheet using script with id:%scriptId"
  //% group="5. HTTP:"
  export function writeToGoogleSheet(data: string[], scriptId: string) {
    requestFailed = false;
    let dataString = "";
    for (let i = 0; i < data.length; i++) {
      dataString += data[i];
      if (!(i == data.length - 1)) dataString += ";";
    }
    let setBodyAtCMD = 'AT+SHBOD="' + dataString + '",' + dataString.length;
    let doPostAtCmd = 'AT+SHREQ="macros/s/' + scriptId + '/exec",3';

    let tries = 1;
    let response = "ERROR";
    while ((response.includes("ERROR") || requestFailed) && tries <= 5) {
      doSendAtCommand(setBodyAtCMD);
      response = doSendAtCommand(doPostAtCmd);
      basic.pause(500 * tries);
      if (tries == 3) {
        initGoogleSheetWriter()
      }
      if (response.includes("OK") || response.isEmpty()) {// sometimes this cmd return OK, but data isn't sent because connection was terminated
        basic.pause(1000);
        if ((!httpsConnected)) { //seem that Connection broke
          usbLogger.warn(`Https connection is broken. Will reinitialize gsheet`);
          initGoogleSheetWriter(); //reinit
          doSendAtCommand(setBodyAtCMD);
          response = doSendAtCommand(doPostAtCmd);
          usbLogger.info(`Write request resent`);
          basic.pause(1000)
        }
      }
      tries++
    }
  }

  /**
   * GPS init
   */
  //% weight=100 blockId="cloudConnector.gpsInit"
  //% block="init GPS"
  //% group="6. GPS:"
  export function gpsInit() {
    sendAtCommandCheckAck("AT+CGNSPWR=1")
  }

  /**
   * get GPS position
   */
  //% weight=100 blockId="cloudConnector.getPosition"
  //% block="GPS position"
  //% group="6. GPS:"
  export function gpsPosition(): string {
    let modemResponse = doSendAtCommand("AT+CGNSINF");
    let position = "";
    while (!modemResponse.includes("+CGNSINF: 1,1")) {
      basic.pause(1000);
      modemResponse = doSendAtCommand("AT+CGNSINF")
    }
    let tmp = modemResponse.split(",");
    position = tmp[3] + "," + tmp[4];
    return position
  }

  /**
   * Send plain AT command to modem and return response from it
   */
  //% weight=100 blockId="cloudConnector.sendAtCommand"
  //% block="response from AT command: %atCommand || with timeout:%timeout"
  //% group="7. Low level  and debug functions:"
  //% timeout.defl=1000 expandableArgumentMode="toggle"
  export function sendAtCommand(atCommand: string, timeout?: number): string {
    if (timeout) {
      return doSendAtCommand(atCommand, timeout)
    } else {
      return doSendAtCommand(atCommand)
    }
  }
}
