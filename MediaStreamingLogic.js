var HelloWorld;
(function (HelloWorld) {
    var MediaStreamingLogic = /** @class */ (function () {
        function MediaStreamingLogic() {

            //Replace the following with the values from the LiveSwitch Console
            this.applicationId = 'replace-with-your-app-id';
            this.sharedSecret = 'replace-with-your-shared-secret';

            this.channelId = 'hello-world-channel';
            this.gatewayUrl = 'https://cloud.liveswitch.io/';
            this.reRegisterBackoff = 200;
            this.maxRegisterBackoff = 60000;
            this.unregistering = false;
            this.layoutManager = new fm.liveswitch.DomLayoutManager(document.getElementById("my-container"));
            this.downstreamConnections = {};
            // Create a new local media for screen capturing.
            this.localScreenMedia = new fm.liveswitch.LocalMedia(false, true, true);
            // Log to console.
            fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));
        }
        MediaStreamingLogic.getInstance = function () {
            if (MediaStreamingLogic.instance == null) {
                MediaStreamingLogic.instance = new MediaStreamingLogic();
            }
            return MediaStreamingLogic.instance;
        };
        MediaStreamingLogic.prototype.checkAppCredentialsSet = function () {
            if (
                app.applicationId == "replace-with-your-app-id" ||
                app.applicationId == undefined
            ) {
                alert(
                    `ERROR: Your applicationId is not set. Find your Application ID by selecting your chosen Application at your LiveSwitch Admin Console and add it to config.js.`
                );
            }
            if (
                app.sharedSecret == "replace-with-your-shared-secret" ||
                app.sharedSecret == undefined
            ) {
                alert(
                    `ERROR: Your sharedSecret is not set. Find your Shared Secret by selecting your chosen Application at your LiveSwitch Admin Console and add it to config.js.`
                );
            }
        };
        MediaStreamingLogic.prototype.joinAsync = function () {
            const promise = new fm.liveswitch.Promise();

            // Create a client.
            this.client = new fm.liveswitch.Client(this.gatewayUrl, this.applicationId);

            // Generate a token (do this on the server to avoid exposing your shared secret).
            const token = fm.liveswitch.Token.generateClientRegisterToken(
                this.applicationId,
                this.client.getUserId(),
                this.client.getDeviceId(),
                this.client.getId(),
                null,
                [new fm.liveswitch.ChannelClaim(this.channelId)],
                this.sharedSecret
            );

            // Allow re-register.
            this.unregistering = false;

            this.client.addOnStateChange(() => {
                // Write registration state to log.
                fm.liveswitch.Log.debug(
                    `Client is ${new fm.liveswitch.ClientStateWrapper(
                        this.client.getState()
                    )}.`
                );

                if (
                    this.client.getState() === fm.liveswitch.ClientState.Unregistered &&
                    !this.unregistering
                ) {
                    fm.liveswitch.Log.debug(
                        `Registering with backoff = ${this.reRegisterBackoff}.`
                    );
                    this.displayMessage(
                        "Client unregistered unexpectedly, trying to re-register."
                    );

                    // Re-register after a backoff.
                    setTimeout(() => {
                        // Incrementally increase register backoff to prevent runaway process.
                        if (this.reRegisterBackoff <= this.maxRegisterBackoff) {
                            this.reRegisterBackoff += this.reRegisterBackoff;
                        }

                        // Register client with token.
                        this.client
                            .register(token)
                            .then((channels) => {
                                // Reset re-register backoff after successful registration.
                                this.reRegisterBackoff = 200;
                                this.onClientRegistered(channels);
                                promise.resolve(null);
                            })
                            .fail((ex) => {
                                fm.liveswitch.Log.error("Failed to register with Gateway.");
                                promise.reject(ex);
                            });
                    }, this.reRegisterBackoff);
                }
            });

            // Register client with token.
            this.client
                .register(token)
                .then((channels) => {
                    this.onClientRegistered(channels);
                    promise.resolve(null);
                })
                .fail((ex) => {
                    fm.liveswitch.Log.error("Failed to register with Gateway.");
                    promise.reject(ex);
                });

            return promise;
        };

        MediaStreamingLogic.prototype.leaveAsync = function () {
            // Disable re-register.
            this.unregistering = true;
            return this.client
                .unregister()
                .then(() =>
                    this.displayMessage(
                        `Client ${this.client.getId()} has successfully unregistered from channel ${this.channel.getId()}.`
                    )
                )
                .fail(() => fm.liveswitch.Log.error("Unregistration failed."));
        };

        MediaStreamingLogic.prototype.onClientRegistered = function (channels) {
            // Store our channel reference.
            this.channel = channels[0];
            this.displayMessage(
                `Client ${this.client.getId()} has successfully connected to channel ${this.channel.getId()}, Hello World!`
            );

            // Open a new SFU upstream connection.
            this.upstreamConnection = this.openSfuUpstreamConnection(this.localMedia);

            // Open a new SFU downstream connection when a remote upstream connection is opened.
            this.channel.addOnRemoteUpstreamConnectionOpen((remoteConnectionInfo) =>
                this.openSfuDownstreamConnection(remoteConnectionInfo)
            );
        };

        MediaStreamingLogic.localMedia = undefined;
        MediaStreamingLogic.prototype.layoutManager = new fm.liveswitch.DomLayoutManager(
            document.getElementById("my-container")
        );

        MediaStreamingLogic.prototype.startLocalMedia = function () {
            const promise = new fm.liveswitch.Promise();

            if (this.localMedia == null) {
                // Create local media with audio and video enabled.
                const audioEnabled = true;
                const videoEnabled = true;
                this.localMedia = new fm.liveswitch.LocalMedia(
                    audioEnabled,
                    videoEnabled
                );

                // Set local media in the layout.
                this.layoutManager.setLocalMedia(this.localMedia);
            }

            // Start capturing local media.
            this.localMedia
                .start()
                .then(() => {
                    fm.liveswitch.Log.debug("Media capture started.");
                    promise.resolve(null);
                })
                .fail((ex) => {
                    fm.liveswitch.Log.error(ex.message);
                    promise.reject(ex);
                });

            return promise;
        };

        MediaStreamingLogic.prototype.stopLocalMedia = function () {
            const promise = new fm.liveswitch.Promise();

            // Stop capturing local media.
            this.localMedia
                .stop()
                .then(() => {
                    fm.liveswitch.Log.debug("Media capture stopped.");
                    promise.resolve(null);
                })
                .fail((ex) => {
                    fm.liveswitch.Log.error(ex.message);
                    promise.reject(ex);
                });

            return promise;
        };

        MediaStreamingLogic.upstreamConnection = undefined;

        MediaStreamingLogic.prototype.openSfuUpstreamConnection = function (localMedia) {
            // Create audio and video streams from local media.
            const audioStream = new fm.liveswitch.AudioStream(localMedia);
            const videoStream = new fm.liveswitch.VideoStream(localMedia);

            // Create a SFU upstream connection with local audio and video.
            const connection = this.channel.createSfuUpstreamConnection(
                audioStream,
                videoStream
            );

            connection.addOnStateChange((conn) => {
                fm.liveswitch.Log.debug(
                    `Upstream connection is ${new fm.liveswitch.ConnectionStateWrapper(
                        conn.getState()
                    ).toString()}.`
                );
            });

            connection.open();

            return connection;
        };

        MediaStreamingLogic.prototype.openSfuDownstreamConnection = function (remoteConnectionInfo) {
            // Create remote media.
            const remoteMedia = new fm.liveswitch.RemoteMedia();
            const audioStream = new fm.liveswitch.AudioStream(remoteMedia);
            const videoStream = new fm.liveswitch.VideoStream(remoteMedia);

            // Add remote media to the layout.
            this.layoutManager.addRemoteMedia(remoteMedia);

            // Create a SFU downstream connection with remote audio and video.
            const connection = this.channel.createSfuDownstreamConnection(
                remoteConnectionInfo,
                audioStream,
                videoStream
            );

            // Store the downstream connection.
            this.downstreamConnections[connection.getId()] = connection;

            connection.addOnStateChange((conn) => {
                fm.liveswitch.Log.debug(
                    `Downstream connection is ${new fm.liveswitch.ConnectionStateWrapper(
                        conn.getState()
                    ).toString()}.`
                );

                // Remove the remote media from the layout and destroy it if the remote is closed.
                if (conn.getRemoteClosed()) {
                    delete this.downstreamConnections[connection.getId()];
                    this.layoutManager.removeRemoteMedia(remoteMedia);
                    remoteMedia.destroy();
                }
            });

            connection.open();
            return connection;
        };
        MediaStreamingLogic.downstreamConnections = { };

        MediaStreamingLogic.prototype.displayMessage = function (msg) {
            const textContainer = document.getElementById("text-container");
            textContainer.appendChild(document.createTextNode(msg));
            textContainer.appendChild(document.createElement("br"));
        };
        return MediaStreamingLogic;
    }());
    HelloWorld.MediaStreamingLogic = MediaStreamingLogic;
})(HelloWorld || (HelloWorld = {}));
