const Device = require('./Device');
const homebridge = require('./homebridge');

class MediaRenderer1 extends Device {
    constructor(platform, USN, accessory) {
        super(platform, USN, accessory);

        this._handleEvent = this._handleEvent.bind(this);
    }

    _createAccessory(description) {
        let accessory = this._accessory;

        if (!accessory) {
            let UUID = description.UDN.substr('uuid:'.length);

            // Some UPnP devices provide not UUID v4, so make it compatible
            if(!homebridge.hap.uuid.isValid(UUID)) {
                UUID = homebridge.hap.uuid.generate(UUID);
            }

            accessory = new homebridge.platformAccessory(description.friendlyName, UUID);
            accessory.context.USN = this.USN;
            accessory.context.ST = 'urn:schemas-upnp-org:device:MediaRenderer:1';
            this._accessory = accessory;
        }

        this._updateAccessory(description);

        let switchService = this.accessory.getService(homebridge.hap.Service.Speaker);

        if (!switchService) {
            this.accessory.addService(homebridge.hap.Service.Speaker);
            switchService = this.accessory.getService(homebridge.hap.Service.Speaker)
        }

        switchService.getCharacteristic(homebridge.hap.Characteristic.On)
            .on('get', (callback) => {
                this._getMute((err, value) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    callback(null, !value);
                })
            })
            .on('set', (value, callback) => this._setMute(!value, callback));

        switchService.getCharacteristic(homebridge.hap.Characteristic.Volume)
            .on('get', this._getVolume.bind(this))
            .on('set', this._setVolume.bind(this));
    }

    _updateAccessory(description) {
        const informationService = this.accessory.getService(homebridge.hap.Service.AccessoryInformation);

        if (description.friendlyName) {
            informationService.getCharacteristic(homebridge.hap.Characteristic.Manufacturer).updateValue(description.friendlyName);
        }

        if (description.manufacturer) {
            informationService.getCharacteristic(homebridge.hap.Characteristic.Manufacturer).updateValue(description.manufacturer);
        }

        if (description.modelName) {
            informationService.getCharacteristic(homebridge.hap.Characteristic.Model).updateValue(description.modelName);
        }

        if (description.serialNumber) {
            informationService.getCharacteristic(homebridge.hap.Characteristic.SerialNumber).updateValue(description.serialNumber);
        }
    }

    onStart() {
        this._client.subscribe('RenderingControl', this._handleEvent);
    }

    onAlive() {
        this._getMute((err, value) => {
            if (err) {
                this._platform.log.error(err);
                return;
            }

            this.accessory.getService(homebridge.hap.Service.Speaker).getCharacteristic(homebridge.hap.Characteristic.On).updateValue(!value);
        });

        this._getVolume((err, value) => {
            if (err) {
                this._platform.log.error(err);
                return;
            }

            this.accessory.getService(homebridge.hap.Service.Speaker).getCharacteristic(homebridge.hap.Characteristic.Volume).updateValue(value);
        });
    }

    onBye() {
        this.accessory.getService(homebridge.hap.Service.Speaker).getCharacteristic(homebridge.hap.Characteristic.On).updateValue(false);
    }

    stop() {
        if (this._client) {
            this._client.unsubscribe('RenderingControl', this._handleEvent);
        }
    }

    _handleEvent(event) {
        if (event.Volume) {
            const volume = parseInt(event.Volume);

            this.accessory.getService(homebridge.hap.Service.Speaker).getCharacteristic(homebridge.hap.Characteristic.Volume).updateValue(volume);
        }

        if (event.Mute) {
            const mute = Boolean(parseInt(event.Mute));

            this.accessory.getService(homebridge.hap.Service.Speaker).getCharacteristic(homebridge.hap.Characteristic.On).updateValue(!mute);
        }
    }

    _getMute(callback) {
        if (this._client === null) {
            callback(new Error('Client not initialized'));
            return;
        }

        this._client.callAction('RenderingControl', 'GetMute', {
            InstanceID: 0,
            Channel: 'Master'
        }, function (err, result) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, Boolean(parseInt(result.CurrentMute)));
        });
    }

    _getVolume(callback) {
        if (this._client === null) {
            callback(new Error('Client not initialized'));
            return;
        }

        this._client.callAction('RenderingControl', 'GetVolume', {
            InstanceID: 0,
            Channel: 'Master'
        }, function (err, result) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, parseInt(result.CurrentVolume));
        });
    }

    _setMute(value, callback) {
        if (this._client === null) {
            callback(new Error('Client not initialized'));
            return;
        }

        this._client.callAction('RenderingControl', 'SetMute', {
            InstanceID: 0,
            Channel: 'Master',
            DesiredMute: value
        }, callback);
    }

    _setVolume(value, callback) {
        if (this._client === null) {
            callback(new Error('Client not initialized'));
            return;
        }

        this._client.callAction('RenderingControl', 'SetVolume', {
            InstanceID: 0,
            Channel: 'Master',
            DesiredVolume: value
        }, callback);
    }
}

module.exports = MediaRenderer1;
