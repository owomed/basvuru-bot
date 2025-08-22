// Gerekli modülleri import edin
const {
    Client,
    Collection,
    IntentsBitField,
    Partials,
    REST,
    Routes,
    ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Client'ı oluştururken Discord.js v14 için gerekli Intenleri kullanın.
// 'MessageContent' intent'inin Discord Developer Portal'da da etkinleştirildiğinden emin olun.
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent, // Mesaj içeriğini okumak için bu intent GEREKLİ
        IntentsBitField.Flags.DirectMessages,
    ],
    partials: [Partials.Channel]
});

// Komut ve Slash Komutları için koleksiyonlar oluşturun
client.commands = new Collection();
client.slashCommands = new Collection();

// --- Tüm Komutları Yükleme İşlemi ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const slashCommandsData = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Komutun slash komutu mu yoksa normal komut mu olduğunu kontrol edin
    // Eğer 'data' ve 'execute' varsa slash komutu olarak yükle
    if ('data' in command && 'execute' in command) {
        client.slashCommands.set(command.data.name, command);
        slashCommandsData.push(command.data.toJSON());
    }

    // Eğer 'name' varsa prefix komutu olarak yükle
    if ('name' in command) {
        client.commands.set(command.name, command);
    }
}

console.log('[LOG] Tüm komutlar başarıyla yüklendi.');

// --- Prefix Değerini Ayarlama ---
const prefix = process.env.PREFIX || '+';

// --- Eventleri Yükleme İşlemi ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}
console.log('[LOG] Eventler başarıyla yüklendi.');

// --- Slash Komutlarını Kaydetme ---
client.once('ready', async () => {
    console.log(`[LOG] Bot ${client.user.tag} olarak aktif!`);
    
    if (slashCommandsData.length > 0) {
        try {
            console.log('[LOG] Slash komutları Discord\'a kaydediliyor.');
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

            await rest.put(
                Routes.applicationCommands(client.user.id), {
                    body: slashCommandsData
                },
            );
            console.log('[LOG] Slash komutları başarıyla kaydedildi!');
        } catch (error) {
            console.error('[HATA] Slash komutları kaydedilirken bir hata oluştu:', error);
        }
    } else {
        console.log('[LOG] Hiçbir slash komutu bulunamadı. Kayıt işlemi atlandı.');
    }

    // Botun durumunu ayarlayın
    client.user.setPresence({
        activities: [{
            name: 'MED 🤎 OwO ile ilgileniyor',
            type: ActivityType.Custom
        }],
        status: 'dnd'
    });
});

// --- Slash Komutlarını Dinleme ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    console.log(`[LOG] Bir slash komutu kullanıldı: /${interaction.commandName}`);
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Slash komut çalıştırma hatası:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Bu komut çalıştırılırken bir hata oluştu.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Bu komut çalıştırılırken bir hata oluştu.', ephemeral: true });
        }
    }
});

// --- Prefixli Mesaj Olayını İşleme ---
client.on('messageCreate', async message => {
    // Mesajın bot tarafından gönderilip gönderilmediğini, prefix ile başlayıp başlamadığını ve DM kanalı olup olmadığını kontrol edin.
    if (message.author.bot || !message.content.startsWith(prefix) || message.channel.type === 'dm') {
        return;
    }

    // Komutu ve argümanları ayırın
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Komutu adına veya takma adına (alias) göre bul
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) {
        return console.log(`[UYARI] Prefixli komut bulunamadı: ${prefix}${commandName}`);
    }

    console.log(`[LOG] Bir prefixli komut kullanıldı: ${prefix}${commandName}`);

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error('Prefixli komut çalıştırma hatası:', error);
        message.reply('Komut çalıştırılırken bir hata oluştu.');
    }
});

// Botu Discord'a bağlayın
client.login(process.env.TOKEN);

// Render için HTTP sunucusu (Aynı bırakıldı)
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot aktif ve çalışıyor.');
});

app.listen(port, () => {
    console.log(`[LOG] Render HTTP sunucusu ${port} portunda dinleniyor.`);
});
