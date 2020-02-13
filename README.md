Microbit# Liki SIM7000 GSM/GPRS/IOT Shield

A PXT library for Liki SIM7000 GSM/GPRS/IoT shield

## Blocks

---


### 1. Initialize SIM7000 IoT Shield

This block initalise SIM7000 module

```blocks
sim7000x.init(SerialPin.P0, SerialPin.P1, BaudRate.BaudRate115200,1)
```
<b>Arguments:</b><br>
1-st argument(sim7000TX_Pin): pin of Microbit to which TX pin[of SIM7000] is connected, ex. SerialPin.P0 <br>
2-nd argument(sim7000TX_Pin): pin of Microbit to which RX pin[of SIM7000] is connected, ex. SerialPin.P1 <br>
3-rd argument(sim7000BaudRate): baudrate for communication with sim7000, usually it will be 115200 baud, so ex. BaudRate.BaudRate115200 <br>
4-th argument(logging level): 0 - logging disabled, 1 - logging human readable messages, 2 - logging of complete AT communication between sim7000 and Microbit


### 2. Get GSM signal quality

Returns signal quality in range of 1 to 5 or -1 in case signal quality can't be fetched for various reasons

```blocks
sim7000x.getSignalQuality()
```

### 3. Display signal quality

Display signal quality on Microbit led matrix

```blocks
sim7000x.displaySignalQuality()
```


### 4. Get GSM registartion status

Returns gsm registration status code

```blocks
sim7000x.getGSMRegistrationStatus()
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
sim7000x.sendSmsMessage("+1222333444", "Hello")
```
<b>Arguments:</b><br>
1-st argument(telephone number): Receipment telephone number, must be in format +[country code][telephone number] <br>
2-nd argument(content): Content of sms message, should not contain any special characters.

### 6.Get date and time
Return date and time from gsm network
```blocks
sim7000x.getDateAndTime()
```
returns date and time string in format: yy/mm/dd,hh:mm:ss+tz. <br>
Note: in case gsm network is not reachable it will return "err"

### 7. MQTT init
Initizalize GPRS network and MQTT module
```blocks
sim7000x.MqttInit("Internet")
```
<b>Arguments:</b><br>
1-st argument(ApnName): Operator APN name, this value depends on your sim card operator, just google it: ""[operator name here] apn name" and you'll get it.

### 8. MQTT connect
Connect to MQTT broker
```blocks
sim7000x.MqttConnect(
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

### 9. MQTT publish
Publish message using MQTT protocol
```blocks
sim7000x.MqttPublish(
  "myFancyTopic",
  "message which will be published on "myFancyTopic" topic"
  )
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which MQTT message will be published<br>
2-nd argument(message): message which will be published on topic provided in first argument<br>

### 10. MQTT subscribe
Subscribe on topic using MQTT protocol
```blocks
sim7000x.MqttSubscribe("myFancyTopic")
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which you want to subscribe<br>

### 11. MQTT on subscribed topic message received
Handler for subscribed topic, content of this block will be called when you will receive message on topic which you subscribed with MqttSubscribe block
```blocks
sim7000x.MqttMessageReceived(function (topic, message) {
    basic.showString("received message on topic" + topic)
    basic.showString("message content:" + message)
})
```
<b>Arguments:</b><br>
1-st argument(topic): Topic on which message was received<br>
2-nd argument(message): Content of received message<br>


### 12. HTTP init
Initialize GPRS network and HTTP module

```blocks
sim7000x.HttpInit("Internet")
```
<b>Arguments:</b><br>
1-st argument(ApnName): Operator APN name, this value depends on your sim card operator, just google it: ""[operator name here] apn name" and you'll get it.

### 12. HTTP Post
Do HTTP POST request
```blocks
sim7000x.HttpPost("www.urlToPostTo.com", "{'content':'can be json for example'}")
```
<b>Arguments:</b><br>
1-st argument(url): url to which you want make post request, refeer to http protocol specification to learn more <br>
2-nd argument(data): data(body) of post request


### 13. Init GPS
Initialize/Enable GPS module, by default it's disabled.
```blocks
sim7000x.InitGPS()
```
### 14. Get GPS position
Returns position string in format: lat,lon ex. "23.26577,-85.54324", you can use then this string to build google maps url to location for example:<br>
https://www.google.com/maps/search/?api=1&query=23.26577,-85.54324
```blocks
sim7000x.GPSGetPosition()
```

### 15. USB serial log
Log debug message using serial usb
```blocks
sim7000x.USBSerialLog("Debug message")
```
<b>Arguments:</b><br>
1-st argument(messsage): Message to log

### 16. Send AT command
Send plain AT command and returns modem response
```blocks
sim7000x.SendATCommand("AT+CSQ")
```
<b>Arguments:</b><br>
1-st argument(atCommand): AT command to send<br>
2-nd argument(timeout): Maximum time(in ms) to wait for modem response<br>

---

## Debugging
Some debug information can be fetched by connecting to Microbit serial port when logging level in init block was set to 1 or 2. For how to connect to Microbit serial port please refer to "using a computer terminal" paragraph under following link:
https://support.microbit.org/support/solutions/articles/19000022103-outputing-serial-data-from-the-micro-bit-to-a-computer


## Limitations
This library consumes micro:bit serial module, due to that during usage of this library you should not use "serial" module at all, as this will probably cause some problems. You can still log some message through usb serial but you should use dedicated block "USBSerialLog..." provided by this library.


## License

MIT

## Supported targets

* for PXT/microbit

(The metadata above is needed for package search.)
