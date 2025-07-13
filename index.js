const { REST, Routes } = require('discord.js');
require('dotenv').config();

const CLIENT_ID = '1392944799983730849'; // Your bot's client ID

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🧹 Fetching and deleting all global commands...');

    const commands = await rest.get(Routes.applicationCommands(CLIENT_ID));

    for (const cmd of commands) {
      await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
      console.log(`❌ Deleted command: ${cmd.name}`);
    }

    console.log('✅ All global commands deleted.');
  } catch (error) {
    console.error('❌ Error deleting commands:', error);
  }
})();