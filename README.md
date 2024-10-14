# Discord Bot

This repository contains source code of original CryMP Discord Bot.

## Running

```sh
# install dependencies
npm install

# set DISCORD_TOKEN env variable
export DISCORD_TOKEN=xxx

# run the app
node index.js
```

App can also run as part of an existing Express server, in that case, provide Express server instance as the first argument when creating a Bot instance.
