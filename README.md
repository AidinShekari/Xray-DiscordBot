# Xray-DiscordBot

## Overview

`Xray-DiscordBot` is a Discord bot designed to interact with the Xray Core, allowing you to monitor the online status of users and manage user details directly from your Discord server. 
It integrates with the `Xray-SaveLog` project to provide real-time statistics and user management features.

## Features

- **User Online Status:** Check the online status of users connected to your Xray Core. ( Assign In Channel And Update ).
- **Add Clients:** Use the `/addclient` command to add new users to your Xray Core.
- **User Statistics:** Retrieve detailed statistics about users with the `/userstats` command.

## Prerequisites

Before using this project, you need to set up the [Xray-SaveLog](https://github.com/AidinShekari/Xray-SaveLog) project.

## Installation

1. Clone this repository to your local machine:

    ```bash
    git clone https://github.com/AidinShekari/Xray-DiscordBot.git
    cd Xray-DiscordBot
    ```

2. Install the required dependencies:

    ```bash
    npm install
    ```

3. Configure the bot by editing the `config.json` file:

    ```json
    {
      "token": "Discord-Bot-Token",
      "guildId": "guildID",
      "channelId": "channelID",
      "apiUrl": "http://localhost:port",
      "destination": "paneldest",
      "messageId": "",
      "vpndbPath": "/root/vpndb.json",
      "username": "",
      "password": ""
    }
    ```

    - `token`: Your Discord bot token.
    - `guildId`: The ID of the Discord server where the bot will operate.
    - `channelId`: The ID of the Discord channel where the bot will post updates.
    - `apiUrl`: The URL of your Xray-SaveLog API.
    - `destination`: The panel destination (customize as per your setup).
    - `messageId`: Leave this blank or use it to specify a message ID for persistent bot messages.
    - `vpndbPath`: The path to your `vpndb.json` file.
    - `username` and `password`: Credentials for authenticating with your xray-dashboard.


## Usage

Once the bot is up and running, you can interact with it using the following commands in your Discord server:

- `/addclient`: Add a new client to the Xray Core.
- `/userstats`: Get detailed statistics for a specific user.

![image](https://github.com/user-attachments/assets/7de2ca87-9e33-4431-bc80-7d78c99c3c3e)

![image](https://github.com/user-attachments/assets/b98e8f82-d034-4e95-b131-d465e944b86f)


