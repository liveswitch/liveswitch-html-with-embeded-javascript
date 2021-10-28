# LiveSwitch HTML with Embedded JavaScript Examples

This repository includes HTML with embedded JavaScript examples that demonstrates how to do the following:

* Create an SFU connection to stream video and audio
* Mute media
* Share screen
* Text chat
* Send and receive files
* Change devices
* Broadcast

## Tools You Need

* [node.js](https://nodejs.org/en/)
* [npm](https://www.npmjs.com/)

## Add an Application in LiveSwitch

Before you can run the app, you must add an Application in the LiveSwitch Console.

1. Log into the [LiveSwitch Console](https://console.liveswitch.io/). If you don't have an account, [contact us](mailto:sales@liveswitch.io) about trying out LiveSwitch.
1. Click **Applications** > **New**.
1. Enter a name for your Application.
1. Click the Application you just created to open the **Application Settings** page. You can find your Application ID and Shared Secret there. This information is needed for [generating your authorization token](xref:token).

## Run the App

1. Check out this repository and update `/MediaStreamingLogic.js` with your own Application ID and Shared Secret.
1. Install all the dependencies:

   ```
   npm install
   ```

1. Install a lightweight HTTP server:

   ```
   npm install -g http-server
   ```
1. Start a web server:

   ```
   http-server

   ```
1. Navigate to `http://127.0.0.1:8080/` and select an example page.  

For a more detailed set up, visit [LiveSwitch's documentation](https://developer.liveswitch.io/liveswitch-cloud/get-started/js/quickstart-js.html).