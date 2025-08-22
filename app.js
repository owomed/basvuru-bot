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
require('dotenv').config();

// Client'ı oluştururken v14 Intent ve Partials kullanın.
// Bu, botun sadece ihtiyacı olan olayları dinlemesini sağlar ve performansı artırır.
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.DirectMessageReactions,
        IntentsBitField.Flags.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
    ]
});

// Komut ve Slash Komutları için Collection'lar oluşturun
client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();

// Prefix değerini .env dosyasından çekin
const prefix = process.env.PREFIX || '+';

// --- Komutları Yükleme İşlemi ---
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}
console.log('[LOG] Prefixli komutlar başarıyla yüklendi.');

// --- Eventleri Yükleme İşlemi ---
const eventFiles = fs.readdirSync('./events/').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}
console.log('[LOG] Eventler başarıyla yüklendi.');

// --- Slash Komutlarını Kaydetme ve Yükleme İşlemi ---
const slashCommands = [];
const slashCommandFiles = fs.readdirSync('./slashCommands/').filter(file => file.endsWith('.js'));

if (slashCommandFiles.length > 0) {
    for (const file of slashCommandFiles) {
        const slashCommand = require(`./slashCommands/${file}`);
        client.slashCommands.set(slashCommand.data.name, slashCommand);
        slashCommands.push(slashCommand.data.toJSON());
    }
    console.log('[LOG] Slash komutları başarıyla yüklendi.');

    client.once('ready', async () => {
        try {
            console.log('[LOG] Slash komutları Discord\'a kaydediliyor.');
            const rest = new REST({
                version: '10'
            }).setToken(process.env.TOKEN);

            await rest.put(
                Routes.applicationCommands(client.user.id), {
                    body: slashCommands
                },
            );
            console.log('[LOG] Slash komutları başarıyla kaydedildi!');
        } catch (error) {
            console.error('[HATA] Slash komutları kaydedilirken bir hata oluştu:', error);
        }
    });
}


// --- Prefixli Mesaj Olayını İşleme ---
client.on('messageCreate', async message => {
    // Mesajın prefix ile başlayıp başlamadığını, bot olup olmadığını ve DM kanalı olup olmadığını kontrol edin.
    if (!message.content.startsWith(prefix) || message.author.bot || message.channel.type === 'dm') return;

    // Komutu ve argümanları ayırın
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    try {
        await command.execute(client, message, args);
    } catch (error) {
        console.error('Komut çalıştırma hatası:', error);
        message.reply('Komut çalıştırılırken bir hata oluştu.');
    }
});


// --- Tarih formatı ve hesaplama fonksiyonları (Aynı bırakıldı) ---
Date.prototype.toTurkishFormatDate = function(format) {
    let date = this,
        day = date.getDate(),
        weekDay = date.getDay(),
        month = date.getMonth(),
        year = date.getFullYear(),
        hours = date.getHours(),
        minutes = date.getMinutes(),
        seconds = date.getSeconds();

    let monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    let dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    if (!format) {
        format = 'dd MM yyyy | hh:ii:ss';
    }
    format = format.replace('mm', month.toString().padStart(2, '0'));
    format = format.replace('MM', monthNames[month]);

    if (format.indexOf('yyyy') > -1) {
        format = format.replace('yyyy', year.toString());
    } else if (format.indexOf('yy') > -1) {
        format = format.replace('yy', year.toString().substr(2, 2));
    }

    format = format.replace('dd', day.toString().padStart(2, '0'));
    format = format.replace('DD', dayNames[weekDay]);

    if (format.indexOf('HH') > -1) format = format.replace('HH', hours.toString().replace(/^(\d)$/, '0$1'));
    if (format.indexOf('hh') > -1) {
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        format = format.replace('hh', hours.toString().replace(/^(\d)$/, '0$1'));
    }
    if (format.indexOf('ii') > -1) format = format.replace('ii', minutes.toString().replace(/^(\d)$/, '0$1'));
    if (format.indexOf('ss') > -1) format = format.replace('ss', seconds.toString().replace(/^(\d)$/, '0$1'));
    return format;
};

client.tarihHesapla = (date) => {
    const startedAt = Date.parse(date);
    var msecs = Math.abs(new Date() - startedAt);

    const years = Math.floor(msecs / (1000 * 60 * 60 * 24 * 365));
    msecs -= years * 1000 * 60 * 60 * 24 * 365;
    const months = Math.floor(msecs / (1000 * 60 * 60 * 24 * 30));
    msecs -= months * 1000 * 60 * 60 * 24 * 30;
    const weeks = Math.floor(msecs / (1000 * 60 * 60 * 24 * 7));
    msecs -= weeks * 1000 * 60 * 60 * 24 * 7;
    const days = Math.floor(msecs / (1000 * 60 * 60 * 24));
    msecs -= days * 1000 * 60 * 60 * 24;
    const hours = Math.floor(msecs / (1000 * 60 * 60));
    msecs -= hours * 1000 * 60 * 60;
    const mins = Math.floor((msecs / (1000 * 60)));
    msecs -= mins * 1000 * 60;
    const secs = Math.floor(msecs / 1000);
    msecs -= secs * 1000;

    var string = '';
    if (years > 0) string += `${years} yıl ${months} ay`;
    else if (months > 0) string += `${months} ay ${weeks > 0 ? weeks + ' hafta' : ''}`;
    else if (weeks > 0) string += `${weeks} hafta ${days > 0 ? days + ' gün' : ''}`;
    else if (days > 0) string += `${days} gün ${hours > 0 ? hours + ' saat' : ''}`;
    else if (hours > 0) string += `${hours} saat ${mins > 0 ? mins + ' dakika' : ''}`;
    else if (mins > 0) string += `${mins} dakika ${secs > 0 ? secs + ' saniye' : ''}`;
    else if (secs > 0) string += `${secs} saniye`;
    else string += `saniyeler`;

    string = string.trim();
    return `\`${string} önce\``;
};

// --- Bot Durumunu Güncelleme ---
const statuses = [
    {
        name: 'Başvuruları kontrol ediyor',
        type: ActivityType.Watching
    },
    {
        name: 'Başvuru yapanlar',
        type: ActivityType.Competing
    },
    {
        name: 'MED 💚 hicckimse',
        type: ActivityType.Competing
    },
    {
        name: 'hicckimse 💛 MED',
        type: ActivityType.Competing
    },
    {
        name: 'MED ❤️ hicckimse',
        type: ActivityType.Competing
    },
    {
        name: 'hicckimse 🤍 MED',
        type: ActivityType.Competing
    },
    {
        name: 'MED 🤎 hicckimse',
        type: ActivityType.Competing
    },
    {
        name: 'hicckimse 💜 MED',
        type: ActivityType.Competing
    },
    {
        name: 'MED ❤ hicckimse',
        type: ActivityType.Competing
    },
    {
        name: 'hicckimse 💙 MED',
        type: ActivityType.Competing
    },
    {
        name: 'MED 🤎 OwO ile ilgileniyor',
        type: ActivityType.Custom
    }
];
let statusIndex = 0;

client.on('ready', async () => {
    console.log(`[LOG] Bot ${client.user.tag} olarak aktif!`);
    client.user.setPresence({
        activities: [{
            name: statuses[0].name,
            type: statuses[0].type
        }],
        status: 'dnd'
    });

    setInterval(() => {
        statusIndex = (statusIndex + 1) % statuses.length;
        client.user.setPresence({
            activities: [{
                name: statuses[statusIndex].name,
                type: statuses[statusIndex].type
            }],
            status: 'dnd'
        });
    }, 10000);
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
