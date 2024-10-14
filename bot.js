const Discord = require("discord.js");
const request = require("request");

async function getJson(url) {
    return new Promise((resolve, reject) => {
        request.get(url, {headers: {"Accept": "application/json"}}, (e, resp, body) => {
            if(e) return reject(e)
            resolve(JSON.parse(body))
        })
    })
}

class DiscordBot {
    /**
     * Create new Discord bot instance
     * @param {import("express").Application} app 
     */
    constructor(app, token) {
        this.commands = {}
        this.app = app;
        this.totalMessages = 0;
        this.lastSync = 0;
        this.alive = false;
        this.tested = false;
        this.messages = [];
        this.client = new Discord.Client()

        if(app != null) {
            app.get("/discord/state", (req, res) => {
                res.send({
                    alive: this.alive,
                    tested: this.tested,
                    timeSinceLastSync: Date.now() - this.lastSync,
                    messagesProcessed: this.totalMessages,
                    messages: this.messages
                })
            })
        }

        this.registerCommands()

        this.client.on("ready", () => {
            console.log("Discord bot active");
            this.client.user.setActivity(`😊`);
            this.alive = true;
        });

        this.client.on("message", (message) => this.onMessage(message));

        this.client.login(token);
        
        setInterval(() => {
            if (!this.alive) return false;
            getJson("https://crymp.net/api/servers")
                .then(servers => {
                    const count = servers.reduce((a, b) => a + b.numpl, 0);
                    let msg = "No players online 😔";
                    if (count == 1) msg = "1 player online 🤩";
                    else if (count < 5 && count > 1) msg = count + " players online 🤗";
                    else if (count >= 5) msg = count + " players online 😊";
                    this.client.user.setActivity(msg);
                })
                .catch(e => console.error(e))
        }, 30000);
    }

    /**
     * On message
     * @param {Discord.Message} message 
     * @returns 
     */
    async onMessage(message) {
        this.totalMessages++
        if (message.author.bot) return;
        this.messages.push({
            id: message.id,
            createdAt: message.createdAt,
            channel: message.channel.name,
            channelId: message.channel.id,
            author: {
                name: message.author.username,
                id: message.author.id
            },
            type: message.type,
            content: message.content
        })
        if (this.messages.length > 100) {
            this.messages.shift()
        }
        if (message.content.startsWith("!")) {
            const cmd = message.content.substring(1)
            const words = cmd.split(" ")
            //console.log("Words: ", words)
            if (words.length > 0) {
                const cmdName = words.shift()
                //console.log("CmdName: ", cmdName)
                if (typeof (this.commands[cmdName]) == "function") {
                    //console.log("Found!")
                    //const channel = this.client.channels.find("id", message.channel.id)
                    try {
                        const res = this.commands[cmdName](message.channel, message, ...words)
                        if(res instanceof Promise) {
                            await res;
                        }
                    } catch(ex) {
                        console.error(ex)
                        return this.replyTo(message.channel, message, "Oops, something went wrong 😖");
                    }
                }
            }
        }
    }

    /**
     * Reply to
     * @param {Discord.Channel} channel 
     * @param {Discord.Message} message 
     * @param {string} response 
     */
    replyTo(channel, message, response) {
        // this.replyTo(channel, message, )
        if (response.length > 2000) response = response.substring(0, 2000) + "..."
        return channel.send(response)
    }


    registerCommands() {
        this.register("online", async (channel, message, ...params) => {
            let servers = await getJson("https://crymp.net/api/servers")
            if (typeof (params) != "undefined" && params.length > 0) {
                const line = message.content.substring("!online ".length).trim()
                if (line.length >= 3) {
                    const r = servers.filter(sv => sv.name.match(new RegExp(line.replace(/ /g, ".*"), "ig")) != null)
                    if (!r || r.length == 0) {
                        return this.replyTo(channel, message, "No server found with such name");
                    }
                    let server = null
                    if (r.length > 1) {
                        for (let k = 0; k < r.length; k++) {
                            if (r[k].name.trim().toLowerCase() == line.trim().toLowerCase()) {
                                server = r[k];
                                break;
                            }
                        }
                        if (server == null) {
                            return this.replyTo(channel, message, "Found " + r.length + " servers with similar name, pick one:\n" + r.map(server => " ▪ " + server.name).join("\n"));
                        }
                    } else {
                        server = r[0]
                    }
                    let timeLeft = Math.floor(server.ntimel / 3600) + " hours, " + Math.floor(server.ntimel / 60 % 60) + " minutes"

                    let finalMessage = [
                        `${server.name}`,
                        ` Online: ${server.numpl} / ${server.maxpl}`,
                        ` Map: ${server.map}`,
                        ` Time left: ${server.ntimel == 0 ? "-" : timeLeft}`,
                    ]
                    if (server.numpl > 0 && server.players.length > 0) {
                        finalMessage.push(" Players:")
                        const players = server.players.map(k => {
                            return `  ${k.name} with ${k.kills} kills and ${k.deaths} deaths`
                        })
                        finalMessage.push(...players)
                    }
                    this.replyTo(channel, message, finalMessage.join("\n"))
                } else {
                    this.replyTo(channel, message, "Server name must be at least 3 characters long")
                }
                return;
            }

            servers = servers.filter(sv => sv.numpl > 0)
            
            if (!servers || servers.length == 0) {
                return this.replyTo(channel, message, "There are no online players right now 😞");
            }

            this.replyTo(channel, message, `There are ${servers.length} currently played servers with total of ${servers.reduce((a, b) => a + b.numpl, 0)} active players:\n${servers.map(server => { return " ▪ " + server.name + ": " + server.numpl + "/" + server.maxpl }).join("\n")}`)
        })
    }

    /**
     * Register command
     * @param {string} cmd 
     * @param {((channel: Discord.Channel, message: Discord.Message, ... params: string[]) => void)} callback 
     */
    register(cmd, callback) {
        this.commands[cmd] = callback
    }
}

module.exports = DiscordBot;
