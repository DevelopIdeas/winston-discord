const winston = require('winston');
const Transport = require('winston-transport');
const util = require('util');
// const https = require('https');
const request = require('request');

const defaultColors = {
	error: 0xE8341C,
	warn: 0xF2D42C,
	info: 0x68C244,
	verbose: 0x1CC3E8,
	debug: 0xFF70FF,
	silly: 0x999999,
};

const noColor = 0x36393E;

module.exports = class DiscordLogger extends Transport {
	constructor(opts) {
		super(opts);
		this.name = opts.name || 'DiscordLogger';
		this.level = opts.level || 'info';
		this.level = this.level.toLowerCase();
	
		this.colors = opts.colors || opts.colors === false ? false : defaultColors;
		if (typeof opts.colors === 'object')
			this.colors = opts.colors;
	
		this.inline = opts.inline;
	
		if (!opts.webhooks)
			throw new Error('Webhooks have to be set in opts');
	
		let webhooks = [];
		if (typeof opts.webhooks === 'string' || (typeof opts.webhooks === 'object' && !Array.isArray(opts.webhooks))) {
			webhooks.push(opts.webhooks)
		} else if (Array.isArray(opts.webhooks)) {
			webhooks = opts.webhooks;
		} else {
			throw new Error(`Webhooks has to be type 'string', 'object' or 'array'`);
		}
	
		webhooks = webhooks.map(webhook => {
			if (typeof webhook === 'string') {
				if (webhook.indexOf('https://discordapp.com/api/') === 0) {
					return { 'url': webhook };
				} else {
					throw new Error(`Invalid webhook URL: ${webhook}`);
				}
				/*const webhookURLRegex = /(https?):\/\/([a-z0-9]*).*(discordapp.com)\/api(?:\/v([0-9]+))*\/webhooks\/([0-9]{1,20})\/([a-z0-9_-]+)/gi;
				const match = webhookURLRegex.exec(webhook);
				if (match) {
					return { 'id': match[5], 'token': match[6] };
				}
	
				throw new Error(`Invalid webhook URL: ${webhook}`);*/
			} else if (typeof webhook === 'object' && webhook.id && webhook.token) {
				return {'id': webhook.id, 'token': webhook.token};
			} else {
				throw new Error(`Webhook has no or invalid ID or Token: ${webhook}`);
			}
		});
	
		this.webhooks = webhooks;
	}
  
	log(info, callback) {
		setImmediate(() => {
			this.emit('logged', info);
		});
		if (info.level == this.level) {
			this.dispatch(info, callback);
		}
	}

	dispatch(info, callback) {
		let level, msg, timestamp = null;
		let meta = [];
		Object.keys(info).forEach(key => {
			switch (key) {
				case 'level':
					level = info[key];
					break;
				case 'message':
					msg = info[key];
					break;
				case 'timestamp':
					timestamp = info[key];
					break;
				default:
					meta[key] = info[key];
					break;
			}
		})
		const promises = this.webhooks.map(webhook => {
			return new Promise((resolve, reject) => {
				const fields = Object.keys(meta).map(key => {
					let inline = true;
					if (typeof this.inline === 'object') {
						if (typeof this.inline[key] !== 'undefined'){
							inline = this.inline[key];
						}
					} else {
						inline = this.inline;
					}
	
					return { name: key, value: meta[key], inline: inline }
				});
	
				// Request body
				let body = {
					embeds: [{
						title: level.charAt(0).toUpperCase() + level.slice(1),
						description: msg,
						color: this.colors ? this.colors[level] : noColor,
						fields: fields,
						timestamp: new Date().toISOString()
					}]
				};
	
				let url;
				if (webhook.url === undefined) {
					url = `https://discordapp.com/api/v6/webhooks/${webhook.id}/${webhook.token}?wait=true`;
				} else {
					url = webhook.url;
				}
				request.post(url, {
					json: body
				}, (error, response, body) => {
					if (error) {
						console.log(error);
						console.log(response.statusCode);
						console.log(body);
						return reject(error);
					} else {
						return resolve(response);
					}
					// console.log(`statusCode: ${res.statusCode}`)
					// console.log(body)
				});
			});
		});
	
		Promise.all(promises).then(results => {
			callback(null);
		}).catch(error => {
			callback(error);
		});
	}
};
return;
