/**
 * @author Noël Vissers
 * @project Site Watcher
 * @version 1.0.0
 * 
 * Invite link: https://discord.com/oauth2/authorize?client_id=123456789012345678&scope=bot&permissions=8
 * (replace 123456789012345678 with your client id from https://discord.com/developers/applications)
 * Start: npm start
 */

require('dotenv').config();

const Discord = require('discord.js');
var client = new Discord.Client();
const CronJob = require('cron').CronJob;
const CronTime = require('cron').CronTime;
const got = require('got');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
var crypto = require('crypto');
const fs = require('fs-extra');

const PREFIX = '!'; //Change this to anything you like as a prefix
var regexp = /[^\s"]+|"([^"]*)"/gi;
const file = './src/sites.json';
var sitesToMonitor = [];
const settingsFile = './src/settings.json';
var cronTime = { interval: 5 };

//Events when bot comes online
client.on('ready', () => {
  //Load saved sites
  var tempJson = fs.readJSONSync(file);
  console.log(tempJson);
  sitesToMonitor = [...tempJson];

  //Load saved settings
  tempJson = fs.readJSONSync(settingsFile);
  console.log(tempJson);
  cronTime = tempJson;

  //Start monitoring
  if (cronTime.interval < 60)
    cronUpdate.setTime(new CronTime(`0 */${cronTime.interval} * * * *`));
  else
    cronUpdate.setTime(new CronTime(`0 0 * * * *`));
  cronUpdate.start();
  console.log(`[${client.user.tag}] Ready...\n[${client.user.tag}] Running an interval of ${cronTime.interval} minute(s).`);
})

//Events on message
client.on('message', (message) => {
  //Check if message starts with prefix and remove prefix from string
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  var args = [];
  console.log(`[${message.author.tag}]: ${message.content}`);
  const argsTemp = message.content.slice(PREFIX.length).trim();

  //Split the string in command, and arguments. This part splits on spaces exept if it is between quotes ("a b")
  do {
    var match = regexp.exec(argsTemp);
    if (match != null) {
      args.push(match[1] ? match[1] : match[0]);
    }
  } while (match != null);
  console.log(args);

  //Make command uppercase so !help and !Help both work (including all other commands)
  const CMD_NAME = args.shift().toLowerCase();

  switch (CMD_NAME.toUpperCase()) {
    case "HELP":
      {
        var embed = new Discord.MessageEmbed();
        embed.setTitle("Commands");
        embed.setColor('0x6058f3');
        embed.addField('\`!help\`', 'Show all commands.');
        embed.addField('\`!add <URL> "<CSS SELECTOR>"\`', 'Add site to monitor with optional CSS selector.');
        embed.addField('\`!remove <NR>\`', 'Remove site from list.');
        embed.addField('\`!list\`', 'Show list of added sites.');
        embed.addField('\`!update\`', 'Manually update sites.');
        embed.addField('\`!interval\`', 'Set update interval, default \`5\`.');
        embed.addField('\`!start\`', 'Start automatic monitoring on set interval, default \`on\`.');
        embed.addField('\`!stop\`', 'Stop monitoring.');
        embed.addField('\`!status\`', 'Show monitoring status.');
        message.channel.send(embed);
      } break;
    case "ADD":
      {
        if (args.length === 0) return message.channel.send('Usage: `!add <URL> (<CSS SELECTOR>)`');
        var url = args[0];
        var selector = 'head';
        if (args[1]) {
          selector = args[1];
        }

        //Create site object
        var site = {
          id: url.split('/')[2],
          url: url,
          css: selector,
          lastChecked: 0,
          lastUpdated: 0,
          hash: 0
        };

        //Check if site is valid
        got(site.url).then(response => {
          const dom = new JSDOM(response.body);

          //Get css element
          if (site.css)
            var content = dom.window.document.querySelector(site.css).textContent;
          //Get head is no css element is selected
          else
            var content = dom.window.document.querySelector('head').textContent;

          //Hash the site content so only a short string is saved
          var hash = crypto.createHash('md5').update(content).digest('hex');

          //Set time for added site
          var time = new Date();
          site.lastChecked = time.toLocaleString();
          site.lastUpdated = time.toLocaleString();
          site.hash = hash;

          //Add site to site array
          sitesToMonitor.push(site);
          console.log(sitesToMonitor);

          //Save updated array to file
          fs.outputJSON(file, sitesToMonitor, { spaces: 2 }, err => {
            if (err) console.log(err)
          });

          //Send confirmation message
          var embed = new Discord.MessageEmbed();
          embed.addField(`Site added:`, `Name: ${site.id}\nURL: ${site.url}\nCSS: \`${site.css}\`\n`)
          embed.setColor('0x6058f3');
          message.channel.send(embed);

        }).catch(err => {
          //Return any errors that might occur, like invalid site/css
          return message.channel.send(`Error: \`${err}\``);
        });
      } break;
    case "REMOVE":
      {
        if (args.length === 0 || isNaN(args[0])) return message.channel.send('Usage: `!remove <NR [1-99]>`');
        if (args[0] < 1 || args[0] > 99 || args[0] > sitesToMonitor.length) return message.channel.send('Not a valid number. Usage: `!remove <NR [1-99]>`');

        const id = sitesToMonitor[args[0] - 1].id;
        sitesToMonitor.splice(args[0] - 1, 1);

        fs.outputJSON(file, sitesToMonitor, { spaces: 2 }, err => {
          if (err) console.log(err)
        })

        console.log(sitesToMonitor);
        message.channel.send(`Removed **${id}** from list.`);

      } break;
    case "LIST":
      {
        if (sitesToMonitor.length < 1) return message.channel.send('No sites to monitor. Add one with `!add`.');

        var embed = new Discord.MessageEmbed();
        for (let i = 0; i < sitesToMonitor.length; i++) {
          embed.setTitle(`${sitesToMonitor.length} site(s) being monitored:`);
          embed.addField(`${sitesToMonitor[i].id}`, `URL: ${sitesToMonitor[i].url}\nCSS: \`${sitesToMonitor[i].css}\`\nChecked: ${sitesToMonitor[i].lastChecked}\nUpdated: ${sitesToMonitor[i].lastUpdated}\nRemove: \`!remove ${i + 1}\``);
          embed.setColor('0x6058f3');
        }

        message.channel.send(embed);

      } break;
    case "UPDATE":
      {
        message.channel.send(`Updating \`${sitesToMonitor.length}\` site(s)...`);
        update();
        message.channel.send(`Done...`);
      } break;
    case "INTERVAL":
      if (args.length === 0 || isNaN(args[0]) || args[0] < 1 || args[0] > 60) return message.channel.send('Usage: `!interval <MINUTES [1-60]>`');
      {
        if (Math.round(args[0]) < 60) {
          cronUpdate.setTime(new CronTime(`0 */${Math.round(args[0])} * * * *`));
        } else {
          cronUpdate.setTime(new CronTime(`0 0 * * * *`));
        }
        cronTime.interval = Math.round(args[0]);

        fs.outputJSON(settingsFile, cronTime, { spaces: 2 }, err => {
          if (err) console.log(err)
        });

        message.channel.send(`Interval set to \`${cronTime.interval}\` minutes.`);
        cronUpdate.start();
      } break;
    case "START":
      {
        cronUpdate.start();
        var time = new Date();
        console.log(`Cron started at ${time.toLocaleString()}`);
        message.channel.send(`Started monitoring...`);
      } break;
    case "STOP":
      {
        cronUpdate.stop();
        var time = new Date();
        console.log(`Cron stopped at ${time.toLocaleString()}`);
        message.channel.send('Paused website monitoring... Type `!start` to resume.');
      } break;
    case "STATUS":
      {
        var time = new Date();
        console.log('Status: ', cronUpdate.running);
        if (cronUpdate.running) message.channel.send(`Site Watcher is running with an interval of \`${cronTime.interval}\` minute(s).`);
        else message.channel.send('Site Watcher is not running. Use `!start` to start monitoring websites.');
      } break;
    default:
      message.channel.send('Invalid command...\nType `!help` for a list of commands.');
  }
})

//Update the sites
function update() {
  let channel = client.channels.cache.get(process.env.DISCORDJS_TEXTCHANNEL_ID);

  for (let i = 0; i < sitesToMonitor.length; i++) {
    const url = sitesToMonitor[i].url;
    got(url).then(response => {
      //Get content of site
      const dom = new JSDOM(response.body);

      //If css is selected, only get that part
      if (sitesToMonitor[i].css)
        var content = dom.window.document.querySelector(sitesToMonitor[i].css).textContent;
      //If no css is selected get the whole head
      else
        var content = dom.window.document.querySelector('head').textContent;

      //hash the content of the site, so only a short string is saved
      var hash = crypto.createHash('md5').update(content).digest('hex');

      //Update the time for when the last check was
      var time = new Date();
      sitesToMonitor[i].lastChecked = time.toLocaleString();

      //Check if new has differs from last hash
      if (sitesToMonitor[i].hash != hash) {
        var prevUpdate = sitesToMonitor[i].lastUpdated;
        sitesToMonitor[i].lastUpdated = time.toLocaleString();
        sitesToMonitor[i].hash = hash;

        //Send update to Discord channel
        var embed = new Discord.MessageEmbed();
        embed.setTitle(`🔎 ${sitesToMonitor[i].id} changed!`);
        embed.addField(`URL`, `${sitesToMonitor[i].url}`);
        embed.addField(`CSS`, `\`${sitesToMonitor[i].css}\``);
        embed.addField(`Previous change`, `${prevUpdate}`, true);
        embed.addField(`Updated on`, `${sitesToMonitor[i].lastUpdated}`, true);
        embed.setColor('0x6058f3');
        channel.send(embed);

        //Save the new data in the file
        fs.outputJSON(file, sitesToMonitor, { spaces: 2 }, err => {
          if (err) console.log(err)
        });
      }
    }).catch(err => {
      return console.log(`Error: ${err}`);
    });
  }
}

//Update on set interval
const cronUpdate = new CronJob(`0 */${cronTime.interval} * * * *`, function () {
  var time = new Date();
  console.log(`Cron executed at ${time.toLocaleString()}`);
  update();
}, null, false);

client.login(process.env.DISCORDJS_BOT_TOKEN);