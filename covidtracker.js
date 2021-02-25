/*
* COVID-Tracker written by Robert Baker https://github.com/reiichi001/
* Icon credits: https://pixabay.com/vectors/coronavirus-icon-red-corona-virus-5107715/
*/
const {
	Client,
} = require('discord.js');
const CONFIG = require('./config.json');
const Sequelize = require('sequelize');

const {
	DateTime,
} = require("luxon");

const globalPrefix = CONFIG.prefix;

const client = new Client({
	disableEveryone: true,
});
if (CONFIG.token === '') {
	throw new Error("Please add a token file with your bot key to config.json");
}

client.login(CONFIG.token);

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'covidtracker.sqlite',
});

const DBInfo = sequelize.define('info', {
	ServerID: {
		type: Sequelize.STRING,
		defaultValue: 0,
		allowNull: false,
		unique: false,
	},
	UserID: {
		type: Sequelize.STRING,
		defaultValue: 0,
		allowNull: false,
		unique: false,
	},
	FirstShotGot: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
		allowNull: false,
		unique: false,
	},
	FirstShotDate: {
		type: Sequelize.DATEONLY,
		unique: false,
	},
	SecondShotGot: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
		allowNull: false,
		unique: false,
	},
	SecondShotDate: {
		type: Sequelize.DATEONLY,
		unique: false,
	},
});

// We handle both of these events the same since it's a toggle
const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

// Bot basics
client.once('ready', () => {
	DBInfo.sync();
});


client.on("ready", () => console.log(`COVID-Tracker is online, connected to ${DBInfo.getTableName()} using ${sequelize.getDialect()}.`));
client.on('error', console.error);

// This event handles toggling a pin if someone adds/removes the defined emoji for pins
client.on('raw', async event => {
	// eslint-disable-next-line no-prototype-builtins
	if (!events.hasOwnProperty(event.t)) {
		return;
	}

	const {
		d: data,
	} = event;
	const channel = client.channels.cache.get(data.channel_id);
	const message = await channel.messages.fetch(data.message_id);
	const emojiKey = data.emoji.id ? `<:${data.emoji.name}:${data.emoji.id}>` : data.emoji.name;

	// put any useful logging/debugging here
	console.log(`Server: "${message.guild.name}" Message: ${message.id} Event: ${event.t} Reaction: ${emojiKey}`);
	// console.log(`Emojikey: ${emojiKey} Emoji:${emoji}\n`);
});

// process message commands
client.on('message', async message => {
	if (message.author.bot) {
		return;
	}

	// Checks if the bot was mentioned, with no message after it, returns the prefix.
	const prefixMention = new RegExp(`^\\s*<@!?${client.user.id}>\\s*$`, 'u');
	if (message.content.match(prefixMention)) {
		message.channel.send(`My prefix on this server is \`${globalPrefix}\``);
		return;
	}

	let args;
	if (message.guild && message.content.toLowerCase().startsWith(globalPrefix)) {
		if (!globalPrefix) {
			return;
		}
		args = message.content.slice(globalPrefix.length).trim()
			.split(/\s+/u);
	}
	else {
		return;
	}

	const command = args.shift().toLowerCase();

	if (command === 'help') {
		message.channel.send({
			"embed": {
				"title": `COVID-Tracker Help`,
				"description": `COVID-Tracker is just here to track who's gotten vaccinated.`,
				"fields": [
					{
						"name": `help`,
						"value": `You can use \`${globalPrefix}help\` to display this message.`,
					},
					{
						"name": `list`,
						"value": `You can use \`${globalPrefix}list\` to grab the list of everyone who's gotten their shots.`,
					},
					{
						"name": `trackme`,
						"value": `You can use \`${globalPrefix}trackme\` to add yourself to the tracker list.`,
					},
					{
						"name": `untrackme`,
						"value": `You can use \`${globalPrefix}trackme\` to remove yourself from the tracker list.`,
					},
					{
						"name": `firstshot`,
						"value": `You can use \`${globalPrefix}firstshot date\` to note when you got your first shot. (Uses MM/DD/YYY)`,
					},
					{
						"name": `secondshot`,
						"value": `You can use \`${globalPrefix}secondshot date\` to note when you got your second shot. (Uses MM/DD/YYY)`,
					},
				],
				"color": CONFIG.embed_color,
			},
		});
		return;
	}

	if (command === 'list') {
		console.log("List command used");

		// ask the DB to grab everyone being tracks
		const results = await DBInfo.findAll({
			where: {
				ServerID: message.guild.id,
			},
		});
		// build the output
		const userStatusList = results.map(person => `<@${person.UserID}> - `
			+ `${person.FirstShotGot ? "✅" : "❌"} `
			+ `${person.SecondShotGot ? "✅" : "❌"}\n`)
			.reduce((a, b) => a + b);

		const safeToMeet = results.map(person => person.FirstShotGot && person.SecondShotGot)
			.reduce((a, b) => a && b);

		message.channel.send({
			"embed": {
				"title": `Currently tracked people`,
				"description": `**Here's what I know so far**:\n\n${userStatusList.trim()}`
				+ `\n\n${safeToMeet ? "This group of people can probably hang out!" : "It may not be safe to hang out yet :<"}`,
				"color": CONFIG.embed_color,
			},
		});
		return;
	}

	if (command === 'trackme') {
		console.log("TrackMe command used");

		// check if this person's already being tracked
		const checkIfAdded = await DBInfo.findOne({
			where: {
				ServerID: message.guild.id,
				UserID: message.author.id,
			},
		});

		// a null result means nothing returned
		if (checkIfAdded === null) {
			const affectedRows = await DBInfo.create({
				ServerID: message.guild.id,
				UserID: message.author.id,
			});

			if (affectedRows) {
				message.channel.send({
					"embed": {
						"title": `Added to tracking`,
						"description": `${message.author} has been added to tracking.`,
						"color": CONFIG.embed_color,
					},
				});
				return;
			}
			message.channel.send("Something went wrong...");
			return;
		}
		else {
			message.channel.send({
				"embed": {
					"title": `Already tracking`,
					"description": `${message.author} is already being tracked.`,
					"color": CONFIG.embed_color,
				},
			});
			return;
		}
	}

	if (command === "untrackme") {
		console.log("UnTrackMe command used");

		// set up a default entry for the db
		let  affectedRows = await DBInfo.findOne({
			where: {
				ServerID: message.guild.id,
				UserID: message.author.id,
			},
		});

		if (affectedRows) {
			// we have an entry

			affectedRows = await DBInfo.destroy({
				where: {
					ServerID: message.guild.id,
					UserID: message.author.id,
				},
			});

			if (affectedRows) {
				message.channel.send({
					"embed": {
						"title": `No longer being tracked`,
						"description": `${message.author} is no longer being tracked.`,
						"color": CONFIG.embed_color,
					},
				});
				return;
			}
			else {
				console.log("found an entry but couldn't delete it???");
				message.channel.send("Something went wrong...");
				return;
			}
		}
		else {
			message.channel.send({
				"embed": {
					"title": `You were not being tracked`,
					"description": `${message.author} was already not being tracked.`,
					"color": CONFIG.embed_color,
				},
			});
			return;
		}
	}

	if (command === 'firstshot') {
		console.log("FirstShot command used");
		if (args.length === 0 || args.length > 1) {
			console.log("Do we get here?");
			args = ["invalid"];
		}

		const beingTracked = await DBInfo.findOne({
			where: {
				ServerID: message.guild.id,
				UserID: message.author.id,
			},
		});
		// console.log(beingTracked);

		if (beingTracked !== null && beingTracked.UserID !== null) {
			if (args.length) {
				if (args[0].toLowerCase() === "none") {
					// unset the date and set the bool to false
					const affectedRows = await DBInfo.update(
						{
							FirstShotGot: false,
							FirstShotDate: null,
						},
						{
							where: {
								ServerID: message.guild.id,
								UserID: message.author.id,
							},
						}
					);

					if (affectedRows) {
						message.channel.send({
							"embed": {
								"title": `first vaccination unset`,
								"description": `Your first vaccination shot has been removed.`,
								"color": CONFIG.embed_color,
							},
						});
						return;
					}
				}

				let parsedDate;
				try {
					parsedDate = DateTime.fromFormat(args[0].replace(/<(.*)>/gui, '$1'), "M/d/yyyy");
				}
				catch (e) {
					console.err(e);
					parsedDate = null;
				}

				if (typeof parsedDate !== "object" || typeof parsedDate === "undefined" || parsedDate === null) {
					// return an error message
					// console.error(parsedDate);
					message.channel.send({
						"embed": {
							"title": `Invalid Input`,
							"description": `Your first vaccination shot could not be logged.`
								+ ` Please make sure to use the command like \`${globalPrefix}firstshot MM/DD/YYYY\` `
								+ `or \`${globalPrefix}secondshot None\` if you want to remove it.`,
							"color": CONFIG.embed_color,
						},
					});
					return;
				}

				const affectedRows = await DBInfo.update(
					{
						FirstShotGot: true,
						FirstShotDate: `${parsedDate.toISODate()}`,
					},
					{
						where: {
							ServerID: message.guild.id,
							UserID: message.author.id,
						},
					}
				);

				if (affectedRows) {
					message.channel.send({
						"embed": {
							"title": `First vaccination set`,
							"description": `Your first vaccination shot on ${parsedDate.toFormat("M/dd/yyyy")} has been logged!`,
							"color": CONFIG.embed_color,
						},
					});
					return;
				}
				message.channel.send("Something went wrong...");
				return;
			}
		}
		else {
			message.channel.send({
				"embed": {
					"title": `You are not being tracked`,
					"description": `Your first vaccination shot could not be logged because COVIDTracker isn't tracking you.`
						+ `Please add yourself first with \`${globalPrefix}trackme\` and then use this command.`,
					"color": CONFIG.embed_color,
				},
			});
			return;
		}
	}

	if (command === 'secondshot') {
		console.log("SecondShot command used");
		if (args.length === 0 || args.length > 1) {
			console.log("Do we get here?");
			args = ["invalid"];
		}

		const beingTracked = await DBInfo.findOne({
			where: {
				ServerID: message.guild.id,
				UserID: message.author.id,
			},
		});

		if (beingTracked !== null && beingTracked.UserID !== null) {
			if (args.length) {
				if (args[0].toLowerCase() == "none") {
					// unset the date and set the bool to false
					const affectedRows = await DBInfo.update(
						{
							SecondShotGot: false,
							SecondShotDate: null,
						},
						{
							where: {
								ServerID: message.guild.id,
								UserID: message.author.id,
							},
						}
					);

					if (affectedRows) {
						message.channel.send({
							"embed": {
								"title": `Second vaccination unset`,
								"description": `Your second vaccination shot has been removed.`,
								"color": CONFIG.embed_color,
							},
						});
						return;
					}
				}

				let parsedDate;
				try {
					parsedDate = DateTime.fromFormat(args[0], "M/d/yyyy");
				}
				catch (e) {
					parsedDate = null;
				}

				if (typeof parsedDate !== "object" || typeof parsedDate === "undefined" || parsedDate === null) {
					// return an error message
					message.channel.send({
						"embed": {
							"title": `Invalid Input`,
							"description": `Your second vaccination shot could not be logged.`
								+ ` Please make sure to use the command like \`${globalPrefix}secondshot MM/DD/YYYY\` `
								+ `or \`${globalPrefix}secondshot None\` if you want to remove it.`,
							"color": CONFIG.embed_color,
						},
					});
					return;
				}

				const affectedRows = await DBInfo.update(
					{
						SecondShotGot: true,
						SecondShotDate: `${parsedDate.toISODate()}`,
					},
					{
						where: {
							ServerID: message.guild.id,
							UserID: message.author.id,
						},
					}
				);

				if (affectedRows) {
					message.channel.send({
						"embed": {
							"title": `Second vaccination set`,
							"description": `Your second vaccination shot on ${parsedDate.toFormat("M/dd/yyyy")} has been logged!`,
							"color": CONFIG.embed_color,
						},
					});
					return;
				}
				message.channel.send("Something went wrong...");
				return;
			}
		}
		else {
			message.channel.send({
				"embed": {
					"title": `You are not being tracked`,
					"description": `Your first vaccination shot could not be logged because COVIDTracker isn't tracking you.`
						+ `Please add yourself first with \`${globalPrefix}trackme\` and then use this command.`,
					"color": CONFIG.embed_color,
				},
			});
			return;
		}
	}

	console.log("We shouldn't get here...");
	message.channel.send({
		"embed": {
			"title": `Unknown/unimplemented command`,
			"description": `Unknown bot command entered. You can use \`${globalPrefix}help\` for a list of commands.`,
			"color": CONFIG.embed_color,
		},
	});
});

process.on('unhandledRejection', err => {
	const msg = err.stack.replace(`${__dirname}/`, './');
	console.error("Unhandled Rejection", msg);
});
