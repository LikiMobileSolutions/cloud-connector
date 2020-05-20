# Liki Cloud Connector for Microbit

Microbit MakeCode (PXT) extension intended to be used with Liki Cloud Connector hardware shield. Based on SIM7000. Enables GSM & GPS to reveal power of IoT.

# How to use

## Adding to your application

Just add to your `pxt.json`:
```json
{
    [...]
    "dependencies": {
        [...]
        "cloudConnector": "github:LikiMobileSolutions/cloud-connector#master"
    },
    [...]
}
```

## Blocks

---

### 1. Initialise Cloud Connector

This block initialise Cloud Connector module

```blocks
cloudConnector.init()
```

### 2. Get GSM signal quality

Returns signal quality in range of 1 to 5 or -1 in case signal quality can't be fetched for various reasons

```blocks
cloudConnector.signalQuality()
```

### 3. Display signal quality

Display signal quality on Microbit led matrix

```blocks
cloudConnector.displaySignalQuality()
```


### 4. Get GSM registration status

Returns gsm registration status code

```blocks
cloudConnector.gsmRegistrationStatus()
```
<b>return values:<br></b>
0 - Not registered and not searching for available network<br>
1 - Registered in home network<br>
2 - Not registered but searching for available network<br>
3 - GSM network registration denied<br>
4 - Unknown Status<br>
5 - Registered, roaming network

### 5. Send SMS messages
...Sends sms message using gsm network
```blocks
cloudConnector.sendSmsMessage("+1222333444", "Hello")
```
<b>Arguments:</b><br>
1-st argument(telephone number): Receipment telephone number, must be in format +[2 digit country code][telephone number] <br>
2-nd argument(content): Content of sms message, should not contain any special characters.

### 6. On SMS message received
Handler for handling received sms message, content of this function will be executed when new SMS message will be received
```blocks
cloudConnector.onSmsReceived(function (senderNumber, message) {
    basic.showString("received SMS from: " + senderNumber)
    basic.showString("message: " + message)
})
```
<b>Arguments:</b><br>
1-st argument(senderNumber): Telephone number of SMS sender, will be in format +[2 digit country code][telephone number]<br>
2-nd argument(message): Content of received message<br>

### 7. Get date and time
Return date and time from gsm network
```blocks
cloudConnector.dateAndTime()
```
returns date and time string in format: yy/mm/dd,hh:mm:ss+tz. <br>
Note: in case gsm network is not reachable it will return null

### 8. MQTT init
Initialize GPRS network and MQTT module
```blocks
cloudConnector.initMqtt("Internet")
```
<b>Arguments:</b><br>
1-st argument(apnName): Operator APN name, this value depends on your sim card operator, just google it: "[operator
 name here] apn name" and you'll get it.

### 9. MQTT connect
Connect to MQTT broker
```blocks
cloudConnector.connectToMqtt(
    "broker_url.com",
    "1883",
    "microbit_sensor",
    "johnDoe",
    "superSecretPassword"
    )
```
<b>Arguments:</b><br>
1-st argument(brokerUrl): Url address of MQTT broker server<br>
2-nd argument(brokerPort): port number of broker server <br>
3-rd argument(clientId): id of client, some descriptive string which will identify your client, can be chosen freely <br>
4-th argument(username): Username for authentication by broker <br>
5-th argument(password): password for authentication by broker <br>

### 10. MQTT publish
Publish message using MQTT protocol
```blocks
cloudConnector.publishOnMqtt(
  "myFancyTopic",
  "message which will be published on 'myFancyTopic' topic"
  )
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which MQTT message will be published<br>
2-nd argument(message): message which will be published on topic provided in first argument<br>

### 11. MQTT subscribe
Subscribe on topic using MQTT protocol
```blocks
cloudConnector.subscribeToMqtt("myFancyTopic")
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which you want to subscribe<br>

### 12. MQTT on subscribed topic message received
Handler for subscribed topic, content of this block will be called when you will receive message on topic which you subscribed with MqttSubscribe block
```blocks
cloudConnector.onMqttMessageReceived(function (topic, message) {
    basic.showString("received message on topic" + topic)
    basic.showString("message content:" + message)
})
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which message was received<br>
2-nd argument(message): Content of received message<br>


### 13. HTTP init
Initialize GPRS network and HTTP module

```blocks
cloudConnector.initHttp("Internet")
```
<b>Arguments:</b><br>
1-st argument(ApnName): Operator APN name, this value depends on your sim card operator, just google it: "[operator name here] apn name" and you'll get it.

### 14. HTTP Post
Do HTTP POST request
```blocks
cloudConnector.httpPost("{'content':'can be json for example'}", "www.urlToPostTo.com")
```
<b>Arguments:</b><br>
1-st argument(data): data(body) of post request
2-nd argument(url): url to which you want make post request, reefer to HTTP protocol specification to learn more

### 15. Initialise Google Sheet writer
Initialise Google Sheet writer
```blocks
cloudConnector.initGoogleSheetWriter()
```

### 16. Initialise Google Sheet writer
Initialise Google Sheet writer
```blocks
cloudConnector.writeToGoogleSheet(["sth1", "sth2", "sth3"], "AKfaaabbbCCCdddeeeFFFggghhhIIIjjjkkkLLLmmmnnnOOOpppqMQ8")
```

<b>Arguments:</b><br>
1-st argument(data): Data to send to Google Sheets<br>
2-nd argument(scriptId): id of script which will be used to save data in Google Sheets ([Apps script](https://developers.google.com/apps-script))<br>


### 17. Init GPS
Initialise/Enable GPS module, by default it's disabled.
```blocks
cloudConnector.gpsInit()
```
### 18. Get GPS position
Returns position string in format: lat,lon ex. "23.26577,-85.54324", you can use then this string to build google maps url to location for example:<br>
https://www.google.com/maps/search/?api=1&query=23.26577,-85.54324
```blocks
cloudConnector.getPosition()
```

### 19. Send AT command
Send plain AT command and returns modem response
```blocks
cloudConnector.sendAtCommand("AT+CSQ")
```

<b>Arguments:</b><br>
1-st argument(atCommand): AT command to send<br>
2-nd argument(timeout): Maximum time(in ms) to wait for modem response<br>


## USB Logger blocks

### 1. Initialise USB logger
Log debug message using serial USB
```blocks
usbLogger.init(SerialPin.P0, SerialPin.P1, BaudRate.BaudRate115200, usbLogger.LoggingLevel.INFO)
```

<b>Arguments:</b><br>
1-st argument(txPin): Microbit pin to which TX pin of main part of your (hardware) solution is connected, ex
. SerialPin.P0 <br>
2-nd argument(rxPin): Microbit pin to which RX pin of main part of your (hardware) solution is connected, ex
. SerialPin.P1 <br>
3-rd argument(baudRate): Baud rate for communication with main part of your (hardware) solution, usually it will be
 115200 baud, so ex. BaudRate.BaudRate115200 <br>
4-th argument(loggingLevel): TRACE / DEBUG / INFO / WARN / ERROR

### 2. Log message to USB
Log message using serial USB
```blocks
usbLogger.log("Something gone wrong", usbLogger.LoggingLevel.ERROR)
```
<b>Arguments:</b><br>
1-st argument(messsage): Message to log
2-nd argument(loggingLevel): message logging level

### 3. Specialised logging functions
Log debug message using serial USB
```blocks
usbLogger.trace("Some function called")
usbLogger.debug("Some event occured")
usbLogger.info("Importand event occured")
usbLogger.warn("Something gone not as expected, but can recover")
usbLogger.error("Something gone wrong")
```
<b>Arguments:</b><br>
1-st argument(messsage): Message to log


---

## Debugging
Some debug information can be fetched by connecting to Microbit serial port when logging level in init block was set to 1 or 2. For how to connect to Microbit serial port please refer to "using a computer terminal" paragraph under following link:
[https://support.microbit.org/support/solutions/articles/19000022103-outputing-serial-data-from-the-micro-bit-to-a
-computer](https://support.microbit.org/support/solutions/articles/19000022103-outputing-serial-data-from-the-micro-bit-to-a-computer)


## Limitations
This library consumes Microbit serial module, due to that during usage of this library you should not use "serial" module at all, as this will probably cause some problems. You can still log some message through USB serial but you should use dedicated block "usbLogger" provided by this library.


## License

[MIT](./LICENSE)

## Supported targets

* for PXT/microbit

(The metadata above is needed for package search.)

## Authors

Developed by [Liki Mobile Solutions](https://likims.com)
