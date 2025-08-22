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
        IntentsBitField.Flags.MessageContent, // Mesaj içeriğini okumak için bu intent GEREKLİ
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

// --- Prefix Değerini Ayarlama ---
let prefix = process.env.PREFIX || '+'; // Varsayılan prefix'i başlangıçta belirle
const configPath = path.join(__dirname, 'Settings', 'config.json');

// config.json dosyasının varlığını kontrol et
if (fs.existsSync(configPath)) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Prefix değerinin varlığını ve geçerli bir string olduğunu kontrol edin
        if (config && typeof config.prefix === 'string' && config.prefix.length > 0) {
            prefix = config.prefix;
            console.log(`[LOG] Prefix, config.json dosyasından yüklendi: ${prefix}`);
        } else {
            console.error(`[HATA] config.json dosyasında geçerli bir prefix bulunamadı. Varsayılan prefix (${prefix}) kullanılacak.`);
        }
    } catch (error) {
        console.error(`[HATA] config.json dosyası okunurken bir hata oluştu. Varsayılan prefix (${prefix}) kullanılacak.`, error);
    }
} else {
    console.error(`[HATA] config.json dosyası bulunamadı. Varsayılan prefix (${prefix}) kullanılacak.`);
}

// --- Tüm Komutları Yükleme İşlemi (Tek bir klasörden) ---
const slashCommands = [];
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    
    // Komutun slash komutu mu yoksa normal komut mu olduğunu kontrol edin
    if (command.data && command.data.name) {
        // Bu bir slash komutu
        client.slashCommands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
    // Her iki tür komutu da yüklemek için 'name' özelliğini de kontrol edin.
    if (command.name) {
        client.commands.set(command.name, command);
    }
}
console.log('[LOG] Tüm komutlar başarıyla yüklendi.');

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

// --- Slash Komutlarını Kaydetme ve İşleme ---
client.once('ready', async () => {
    console.log(`[LOG] Bot ${client.user.tag} olarak aktif!`);
    
    if (slashCommands.length > 0) {
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

// --- Yeni: Slash komutlarını dinleme ---
client.on('interactionCreate', async interaction => {
    // Sadece slash komutlarını (chat input) işleyin
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) {
      // Komut bulunamadıysa uyarı ver
      console.warn(`[UYARI] Slash komutu bulunamadı: /${interaction.commandName}`);
      return;
    }

    console.log(`[LOG] Bir slash komutu kullanıldı: /${interaction.commandName}`);
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Slash komut çalıştırma hatası:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: 'Bu komut çalıştırılırken bir hata oluştu. Lütfen komutu tekrar deneyin.'
            }).catch(e => console.error('Hata mesajı düzenlenirken hata:', e));
        } else {
            await interaction.reply({
                content: 'Bu komut çalıştırılırken bir hata oluştu.',
                ephemeral: true
            }).catch(e => console.error('Hata mesajı gönderilirken hata:', e));
        }
    }
});


// --- Prefixli Mesaj Olayını İşleme ---
client.on('messageCreate', async message => {
    // Mesajın prefix ile başlayıp başlamadığını, bot olup olmadığını ve DM kanalı olup olmadığını kontrol edin.
    if (!message.content.startsWith(prefix) || message.author.bot || message.channel.type === 'dm') return;

    // Komutu ve argümanları ayırın
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    console.log(`[LOG] Bir prefixli komut kullanıldı: ${prefix}${commandName}`);

    try {
        await command.execute(message, args); // `client` parametresini kaldırdım, help komutu artık buna ihtiyaç duymuyor.
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
