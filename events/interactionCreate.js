// Bu dosya `./events/` klasörüne taşınmalıdır.
// Bu dosya hem başvuru hem de soru talep butonlarını işler.
// Discord.js v13 ile uyumludur.

const { MessageEmbed, Permissions } = require('discord.js');

module.exports = {
    // Bu dosyanın dinleyeceği olay 'interactionCreate'
    name: 'interactionCreate',

    // Etkileşim olduğunda çalışacak asenkron fonksiyon
    async execute(interaction) {
        // Sadece buton etkileşimlerini dinle, diğer etkileşimleri yok say.
        if (!interaction.isButton()) return;

        // Butonun customId'sine göre ilgili fonksiyonu çalıştır.
        switch (interaction.customId) {
            case 'yetkiliBaşvuru':
            case 'helperBaşvuru':
                // Başvuru butonlarını işleyen kısım
                await handleBasvuru(interaction);
                break;
            case 'soruTalep':
                // Soru talep butonunu işleyen kısım
                await handleSoruTalep(interaction);
                break;
            default:
                // Tanımsız butonları görmezden gel
                return;
        }
    },
};

/**
 * Başvuru butonlarını işleyen fonksiyon.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleBasvuru(interaction) {
    // Discord'un 3 saniyelik yanıt süresi dolmadan önce deferReply ile yanıt ver.
    // ephemeral: true ile sadece etkileşimi başlatan kullanıcıya görünür.
    await interaction.deferReply({ ephemeral: true });

    const { user, customId, guild, client } = interaction;

    // Kategori ve sonuç kanalı ID'leri. Bunları bir config dosyasında tutmak daha düzenli olacaktır.
    const CATEGORY_ID = '1268509251911811175';

    // Başvuru türlerine göre yapılandırma
    const basvuruConfig = {
        yetkiliBaşvuru: {
            namePrefix: 'yetkilib-', // Kanal isimleri küçük harf ve tire ile daha uyumludur.
            questions: [
                'İsim ve yaşınız nedir?',
                'Neden bu pozisyona başvuruyorsunuz?',
                'Bir deneyiminiz var mı? Varsa anlatın.',
                'Sunucuda ne kadar aktif olabilirsiniz?',
                'Neden sizi seçmeliyiz?',
            ],
            resultChannelId: '1268544826727600168',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'], // Onay/Red için gerekli roller
            applicationType: 'Yetkili',
        },
        helperBaşvuru: {
            namePrefix: 'helperb-',
            questions: [
                'İsim ve yaşınız nedir?',
                'Helper deneyiminiz var mı? Varsa anlatın.',
                'Sunucuda ne kadar aktif olabilirsiniz?',
                'OwO bot bilginiz nasıl?',
                'Takım metası bilginiz nedir?',
            ],
            resultChannelId: '1268544982768160788',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'],
            applicationType: 'Helper',
        },
    };

    const config = basvuruConfig[customId];
    if (!config) {
        return interaction.editReply({ content: 'Geçersiz bir başvuru türüyle karşılaşıldı. Lütfen bot sahibine bildirin.' });
    }

    // Kullanıcı adını küçük harfe çevir ve Discord kanal adı kurallarına uygun hale getir.
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `${config.namePrefix}${cleanUsername}`;

    // Mevcut başvuru kanalını kontrol et
    // Kategori ID'si de kontrol edilerek doğru kategorideki kanalın bulunması sağlanır.
    const existingChannel = guild.channels.cache.find(
        (c) => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({ content: `Zaten aktif bir başvuru kanalınız var: <#${existingChannel.id}>` });
    }

    let newChannel;
    try {
        // Yeni başvuru kanalı oluştur
        newChannel = await guild.channels.create(channelName, {
            type: 'GUILD_TEXT', // v13 için 'GUILD_TEXT'
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });
        await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` });

        // Kanala ilk mesajı gönder ve bekleme süresini belirt
        await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**\nFormu doldurmak için **3 dakika** süreniz var.`);

        const responses = [];
        const filter = (m) => m.author.id === user.id;
        const collectorOptions = {
            filter,
            max: 1,
            time: 180000, // 3 dakika = 180000 ms
            errors: ['time'] // Zaman aşımında hata fırlat
        };

        // Soruları sırayla sor ve cevapları topla
        for (const [index, q] of config.questions.entries()) {
            await newChannel.send(`**${index + 1}. ${q}**`);
            try {
                const collected = await newChannel.awaitMessages(collectorOptions);
                responses.push(collected.first().content);
            } catch (error) {
                // Zaman aşımı veya toplama hatası durumunda
                console.log(`Başvuru zaman aşımına uğradı veya hata oluştu: ${user.tag}`);
                await newChannel.send('Başvuru formunu belirtilen sürede doldurmadığınız için kanal kapatılıyor.');
                try {
                    await user.send('Başvuru formunu doldurmadığınız için başvuru kanalınız kapatıldı. Tekrar denemek için butona basabilirsiniz.');
                } catch (e) {
                    console.error(`DM gönderilemedi: ${e.message}`);
                }
                setTimeout(() => newChannel.delete().catch(() => {}), 30000); // 30 saniye sonra kanalı sil
                return; // Fonksiyondan çık
            }
        }

        // Tüm sorular cevaplandıktan sonra bilgilendirme
        await newChannel.send('Başvurunuz başarıyla alındı. Yetkililerimiz en kısa sürede değerlendirecektir.');

        // Başvuru sonuçlarını içeren embed oluştur
        const embed = new MessageEmbed()
            .setTitle(`${config.applicationType} Başvuru`)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) }) // dynamic: true ile GIF avatarları destekle
            .setDescription(`**Başvuru Yapan:** ${user}`)
            .addFields(
                config.questions.map((q, i) => ({
                    name: `❓ ${q}`,
                    value: responses[i] || 'Cevap verilmedi', // Cevap yoksa 'Cevap verilmedi' yaz
                    inline: false,
                }))
            )
            .setColor('#0099ff')
            .setFooter({ text: `${guild.name} | ${config.applicationType} Başvurusu`, iconURL: guild.iconURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        // Sonuç kanalına embed'i gönder
        const resultChannel = client.channels.cache.get(config.resultChannelId);
        if (!resultChannel) {
            console.error(`Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen ID'yi kontrol edin.`);
            await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
            return;
        }

        // Özel emojileri ID ile al, yoksa varsayılan kullan
        const onayEmoji = client.emojis.cache.get('1284130169417764907') || '✅';
        const redEmoji = client.emojis.cache.get('1284130046902145095') || '❌';

        const sentMessage = await resultChannel.send({
            content: `<@&1243478734078742579>`, // Yetkili rolünü etiketle
            embeds: [embed]
        });
        await sentMessage.react(onayEmoji);
        await sentMessage.react(redEmoji);

        // Reaksiyon toplayıcı filtresi
        const reactionFilter = (reaction, reactor) => {
            // Yetkilinin, belirlenen rollerden birine sahip olup olmadığını kontrol et
            const hasRequiredRole = guild.members.cache.get(reactor.id)?.roles.cache.some(role => config.requiredRoles.includes(role.id));
            // Tepki verilen emojinin doğru emoji olup olmadığını kontrol et
            const isCorrectEmoji = reaction.emoji.id === onayEmoji.id || reaction.emoji.id === redEmoji.id;
            // Botun kendi reaksiyonlarını ignore et
            const isNotBot = reactor.id !== client.user.id;
            return isCorrectEmoji && hasRequiredRole && isNotBot;
        };

        const reactionCollector = sentMessage.createReactionCollector({
            filter: reactionFilter,
            max: 1, // Sadece ilk tepkiyi topla
            time: 600000, // 10 dakika = 600000 ms
            errors: ['time']
        });

        reactionCollector.on('collect', async (reaction, reactor) => {
            const onay = reaction.emoji.id === onayEmoji.id;
            const başvuruTürü = config.applicationType;

            const sonuçEmbed = new MessageEmbed()
                .setTitle('Başvurunuz Sonuçlandı')
                .setAuthor({ name: 'MED Başvuru Sistemi' })
                .setDescription(
                    `\`Başvuru Yapan:\` ${user}\n` +
                    `${başvuruTürü} başvurusu <@${reactor.id}> tarafından **${onay ? 'ONAYLANDI' : 'REDDEDİLDİ'}** ${onay ? onayEmoji : redEmoji}`
                )
                .setColor(onay ? '#00ff00' : '#ff0000')
                .setFooter({ text: `${guild.name} | ${başvuruTürü} Başvurusu Sonucu`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            const sonuçKanalı = client.channels.cache.get('1277638999464214558'); // Başvuru sonuçlarının loglandığı kanal
            if (sonuçKanalı) {
                await sonuçKanalı.send({ embeds: [sonuçEmbed] });
            } else {
                console.error('Sonuç log kanalı (1277638999464214558) bulunamadı. Lütfen ID\'yi kontrol edin.');
            }

            try {
                await sentMessage.reactions.removeAll(); // Tüm reaksiyonları kaldır
            } catch (error) {
                console.error('Mesajdaki emojiler kaldırılamadı:', error);
            }
            // Başvuru sahibine DM gönder
            try {
                await user.send({ embeds: [sonuçEmbed] });
            } catch (e) {
                console.error(`Başvuru sonuç DM'si gönderilemedi: ${e.message}`);
            }
        });

        reactionCollector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                console.log('Başvuru mesajına yetkili tarafından zamanında tepki verilmediği için zaman aşımına uğradı.');
                // İsteğe bağlı: Burada ilgili yetkililere bir bilgilendirme yapılabilir.
            }
        });

        // Başvuru kanalı silme bilgilendirmesi ve işlemi
        await newChannel.send('Bu başvuru kanalı 10 saniye içinde otomatik olarak silinecektir.');
        setTimeout(() => newChannel.delete().catch((err) => {
            console.error('Başvuru kanalı silinirken hata oluştu:', err);
        }), 10000); // 10 saniye sonra sil

    } catch (error) {
        console.error('Başvuru kanalı oluşturulurken veya işlenirken genel bir hata oluştu:', error);
        // Eğer kanal oluşturulduysa, hatadan sonra onu silmeye çalış
        if (newChannel) {
            newChannel.delete().catch(err => console.error('Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
}

/**
 * Soru talep butonunu işleyen fonksiyon.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleSoruTalep(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const { user, guild } = interaction;
    const CATEGORY_ID = '1268509251911811175';

    // Kullanıcı adını temizle ve kanal adına ekle
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `soru-talep-${cleanUsername}`;

    // Mevcut soru talep kanalını kontrol et
    const existingChannel = guild.channels.cache.find(
        c => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({ content: `Zaten aktif bir soru talep kanalınız var: <#${existingChannel.id}>` });
    }

    let newChannel;
    try {
        // Yeni soru talep kanalı oluştur
        newChannel = await guild.channels.create(channelName, {
            type: 'GUILD_TEXT',
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });
        await interaction.editReply({ content: `Soru talep kanalınız oluşturuldu: ${newChannel}` });

        // Kanala ilk mesajı gönder
        await newChannel.send(`${user}, merhaba! Lütfen sorunuzu bu kanala yazın.\nBir yetkili en kısa sürede size yardımcı olacaktır.\n**Bu kanal 5 dakika içinde kapanacaktır.**`);

        const filter = (m) => m.author.id === user.id;
        try {
            // Kullanıcıdan mesaj bekleyerek soruyu al
            const collected = await newChannel.awaitMessages({
                filter,
                max: 1,
                time: 300000, // 5 dakika = 300000 ms
                errors: ['time']
            });
            const soru = collected.first().content;
            console.log(`Kullanıcıdan gelen soru: ${soru}`);
            await newChannel.send(`Sorunuz başarıyla alındı. Bir yetkiliye haber verildi. Cevap için lütfen sabırla bekleyin.`);

            // İsteğe bağlı: Burada yetkililere bildirim gönderme mekanizması eklenebilir.
            // Örneğin, bir log kanalına embed ile soruyu gönderme.
            // const staffLogChannel = client.channels.cache.get('YETKILI_LOG_KANAL_ID');
            // if (staffLogChannel) {
            //     const questionEmbed = new MessageEmbed()
            //         .setTitle('Yeni Soru Talebi')
            //         .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
            //         .setDescription(`**Soru Soran:** ${user}\n**Soru:** ${soru}\n**Kanal:** ${newChannel}`)
            //         .setColor('#ffcc00')
            //         .setTimestamp();
            //     await staffLogChannel.send({ embeds: [questionEmbed] });
            // }

        } catch (error) {
            // Zaman aşımı veya mesaj toplama hatası
            console.log(`Soru talep zaman aşımına uğradı veya hata oluştu: ${user.tag}`);
            await newChannel.send('Belirtilen süre içinde mesaj yazmadığınız için bu kanal kapatılıyor.');
            try {
                await user.send('Soru kanalı içinde herhangi bir mesaj yazmadığınız için kanalınız kapatıldı. Tekrar denemek için butona basabilirsiniz.');
            } catch (e) {
                console.error(`DM gönderilemedi: ${e.message}`);
            }
        }

        // Kanalı işlem bittikten sonra 30 saniye sonra kapatma
        setTimeout(() => {
            newChannel.delete().catch(err => {
                console.error('Soru talep kanalı silinemedi:', err);
            });
        }, 30000); // 30 saniye

    } catch (error) {
        console.error('Soru talep kanalı oluşturulurken veya işlenirken genel bir hata oluştu:', error);
        // Eğer kanal oluşturulduysa, hatadan sonra onu silmeye çalış
        if (newChannel) {
            newChannel.delete().catch(err => console.error('Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({ content: 'Soru talep kanalı oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
}
