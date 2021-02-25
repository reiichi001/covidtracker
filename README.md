# covidtracker
Super basic Discord.js bot used to help people track their COVID vaccines and list if it's generally considered safe for all tracked people to meet in person.

### Install Instructions ###
You'll need to copy the config.default.json file to config.json and then add your bot token in order to use it. 

Then run `npm i` to grab all required packages for discord.js and sqlite3

You can then run the bot as `node covidtracker.js` or use a management tool of choice.

### COVID-Tracker Help ###

**help**

You can use `covid!help` to display this message.

**list**

You can use `covid!list` to grab the list of everyone who's gotten their shots.

**trackme**

You can use `covid!trackme` to add yourself to the tracker list.

**untrackme**

You can use `covid!trackme` to remove yourself from the tracker list.

**firstshot**

You can use `covid!firstshot <date>` to note when you got your first shot. (Uses MM/DD/YYY)

**secondshot**

You can use `covid!secondshot <date>` to note when you got your second shot. (Uses MM/DD/YYY)
