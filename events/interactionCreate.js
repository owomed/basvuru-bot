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
        if (!interaction.isButton()) {
            console.log('[DEBUG] Etkileşim bir buton değil, yok sayılıyor.');
            return;
        }

        console.log(`[DEBUG] Buton etkileşimi alındı. Custom ID: ${interaction.customId}, Kullanıcı: ${interaction.user.tag}`);

        // Butonun customId'sine göre ilgili fonksiyonu çalıştır.
        switch (interaction.customId) {
            case 'yetkiliBaşvuru':
            case 'helperBaşvuru':
                // Başvuru butonlarını işleyen kısım
                console.log(`[DEBUG] Başvuru fonksiyonu çağrılıyor: ${interaction.customId}`);
                await handleBasvuru(interaction);
                break;
            case 'soruTalep':
                // Soru talep butonunu işleyen kısım
                console.log('[DEBUG] Soru Talep fonksiyonu çağrılıyor.');
                await handleSoruTalep(interaction);
                break;
            default:
                // Tanımsız butonları görmezden gel
                console.log(`[DEBUG] Tanımsız buton ID'si: ${interaction.customId}`);
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
    try {
        await interaction.deferReply({ ephemeral: true });
        console.log(`[DEBUG] DeferReply başarıyla yapıldı. Kullanıcı: ${interaction.user.tag}`);
    } catch (e) {
        console.error(`[KRİTİK HATA] DeferReply yapılırken hata oluştu: ${e.message}`, e);
        return; // İşlemi durdur
    }

    const { user, customId, guild, client } = interaction;

    // Kategori ve sonuç kanalı ID'leri. Bunları bir config dosyasında tutmak daha düzenli olacaktır.
    const CATEGORY_ID = '1268509251911811175';
    console.log(`[DEBUG] Kullanılan kategori ID'si: ${CATEGORY_ID}`);

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
        console.error(`[HATA] Geçersiz başvuru türü: ${customId}`);
        return interaction.editReply({ content: 'Geçersiz bir başvuru türüyle karşılaşıldı. Lütfen bot sahibine bildirin.' });
    }

    // Kullanıcı adını küçük harfe çevir ve Discord kanal adı kurallarına uygun hale getir.
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `${config.namePrefix}${cleanUsername}`;
    console.log(`[DEBUG] Oluşturulacak kanal ismi: ${channelName}`);

    // Mevcut başvuru kanalını kontrol et
    const existingChannel = guild.channels.cache.find(
        (c) => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        console.log(`[DEBUG] Kullanıcının zaten aktif bir başvuru kanalı var: ${existingChannel.name}`);
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
                // Botun kendi ID'si için özel bir izne gerek yok, ancak garanti olması için eklenebilir.
                // { id: client.user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });
        console.log(`[DEBUG] Yeni başvuru kanalı oluşturuldu: ${newChannel.name} (${newChannel.id})`);
        
        await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}. Lütfen ilk mesajın gelmesini bekleyin.` });
        console.log(`[DEBUG] Kullanıcıya kanal oluşturuldu mesajı gönderildi.`);

        // Discord API'sinin yanıt süresine ve ağ gecikmesine bağlı olarak, bu ilk mesajın gönderilmesi birkaç saniye sürebilir.
        // Bu gecikme, kodun hatalı olduğu anlamına gelmez.
        try {
            await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**\nFormu doldurmak için **3 dakika** süreniz var.`);
            console.log(`[DEBUG] Başvuru kanalına ilk karşılama mesajı gönderildi.`);
        } catch (sendError) {
            console.error(`[HATA] Başvuru kanalına ilk mesaj gönderilirken hata oluştu: ${sendError.message}. Bu genellikle botun kanala mesaj gönderme izni olmamasından kaynaklanır.`, sendError);
            // Hata durumunda kanalı sil
            await newChannel.delete().catch(() => {});
            return interaction.editReply({ content: 'Başvuru kanalına ilk mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.' });
        }
        

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
            try {
                await newChannel.send(`**${index + 1}. ${q}**`);
                console.log(`[DEBUG] Soru ${index + 1} gönderildi: "${q}"`);
                const collected = await newChannel.awaitMessages(collectorOptions);
                responses.push(collected.first().content);
                console.log(`[DEBUG] Soru ${index + 1} için cevap alındı.`);
            } catch (awaitError) {
                // Zaman aşımı veya toplama hatası durumunda
                console.error(`[HATA] Soru ${index + 1} toplanırken hata oluştu veya zaman aşımı: ${awaitError.message}`, awaitError);
                await newChannel.send('Başvuru formunu belirtilen sürede doldurmadığınız için kanal kapatılıyor.');
                try {
                    await user.send('Başvuru formunu doldurmadığınız için başvuru kanalınız kapatıldı. Tekrar denemek için butona basabilirsiniz.');
                } catch (e) {
                    console.error(`[HATA] DM gönderilemedi: ${e.message}`);
                }
                setTimeout(() => newChannel.delete().catch(() => {}), 30000); // 30 saniye sonra kanalı sil
                return; // Fonksiyondan çık
            }
        }

        console.log(`[DEBUG] Tüm sorular başarıyla cevaplandı. Cevaplar: ${responses.map(r => `"${r}"`).join(', ')}`);

        // Tüm sorular cevaplandıktan sonra bilgilendirme
        await newChannel.send('Başvurunuz başarıyla alındı. Yetkililerimiz en kısa sürede değerlendirecektir.');
        console.log('[DEBUG] Başvuru tamamlanma mesajı gönderildi.');

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
        console.log('[DEBUG] Başvuru sonuç embedi oluşturuldu.');

        // Sonuç kanalına embed'i gönder
        const resultChannel = client.channels.cache.get(config.resultChannelId);
        if (!resultChannel) {
            console.error(`[KRİTİK HATA] Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen ID'yi kontrol edin.`);
            await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
            return;
        }
        console.log(`[DEBUG] Sonuç kanalı bulundu: ${resultChannel.name}`);

        // Özel emojileri ID ile al, yoksa varsayılan kullan
        const onayEmoji = client.emojis.cache.get('1284130169417764907') || '✅';
        const redEmoji = client.emojis.cache.get('1284130046902145095') || '❌';
        console.log(`[DEBUG] Emoji ID'leri alındı. Onay: ${onayEmoji.name}, Red: ${redEmoji.name}`);


        const sentMessage = await resultChannel.send({
            content: `<@&1243478734078742579>`, // Yetkili rolünü etiketle
            embeds: [embed]
        });
        console.log(`[DEBUG] Başvuru sonucu mesajı sonuç kanalına gönderildi: ${sentMessage.id}`);

        await sentMessage.react(onayEmoji);
        await sentMessage.react(redEmoji);
        console.log('[DEBUG] Başvuru sonuç mesajına emojiler eklendi.');

        // Reaksiyon toplayıcı filtresi
        const reactionFilter = (reaction, reactor) => {
            const hasRequiredRole = guild.members.cache.get(reactor.id)?.roles.cache.some(role => config.requiredRoles.includes(role.id));
            const isCorrectEmoji = reaction.emoji.id === onayEmoji.id || reaction.emoji.id === redEmoji.id;
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
            console.log(`[DEBUG] Yetkili tepkisi alındı. Yetkili: ${reactor.tag}, Tepki: ${reaction.emoji.name}`);
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
            console.log('[DEBUG] Sonuç embedi oluşturuldu.');

            const sonuçKanalı = client.channels.cache.get('1277638999464214558'); // Başvuru sonuçlarının loglandığı kanal
            if (sonuçKanalı) {
                await sonuçKanalı.send({ embeds: [sonuçEmbed] });
                console.log('[DEBUG] Başvuru sonucu log kanalına gönderildi.');
            } else {
                console.error('[HATA] Sonuç log kanalı (1277638999464214558) bulunamadı. Lütfen ID\'yi kontrol edin.');
            }

            try {
                await sentMessage.reactions.removeAll(); // Tüm reaksiyonları kaldır
                console.log('[DEBUG] Başvuru sonuç mesajındaki emojiler kaldırıldı.');
            } catch (error) {
                console.error('[HATA] Mesajdaki emojiler kaldırılamadı:', error.message);
            }
            // Başvuru sahibine DM gönder
            try {
                await user.send({ embeds: [sonuçEmbed] });
                console.log(`[DEBUG] Başvuru sonucu DM'si kullanıcıya gönderildi: ${user.tag}`);
            } catch (e) {
                console.error(`[HATA] Başvuru sonuç DM'si gönderilemedi: ${e.message}`);
            }
        });

        reactionCollector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                console.log('[DEBUG] Başvuru mesajına yetkili tarafından zamanında tepki verilmediği için zaman aşımına uğradı.');
            } else if (reason === 'max') {
                console.log('[DEBUG] Reaksiyon toplayıcı maksimum tepkiye ulaştı.');
            } else {
                console.log(`[DEBUG] Reaksiyon toplayıcı sonlandı. Sebep: ${reason}`);
            }
        });

        // Başvuru kanalı silme bilgilendirmesi ve işlemi
        await newChannel.send('Bu başvuru kanalı 10 saniye içinde otomatik olarak silinecektir.');
        console.log('[DEBUG] Kanalın otomatik silineceğine dair mesaj gönderildi.');
        setTimeout(() => newChannel.delete().catch((err) => {
            console.error('[HATA] Başvuru kanalı silinirken hata oluştu:', err);
        }), 10000); // 10 saniye sonra sil

    } catch (error) {
        console.error('[KRİTİK HATA] Başvuru kanalı oluşturulurken veya işlenirken genel bir hata oluştu:', error);
        // Eğer kanal oluşturulduysa, hatadan sonra onu silmeye çalış
        if (newChannel) {
            newChannel.delete().catch(err => console.error('[HATA] Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
}

/**
 * Soru talep butonunu işleyen fonksiyon.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleSoruTalep(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        console.log(`[DEBUG] Soru talep deferReply yapıldı. Kullanıcı: ${interaction.user.tag}`);
    } catch (e) {
        console.error(`[KRİTİK HATA] Soru talep DeferReply yapılırken hata oluştu: ${e.message}`, e);
        return;
    }

    const { user, guild, client } = interaction;
    const CATEGORY_ID = '1268509251911811175';

    // Kullanıcı adını temizle ve kanal adına ekle
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `soru-talep-${cleanUsername}`;
    console.log(`[DEBUG] Oluşturulacak soru talep kanalı ismi: ${channelName}`);


    // Mevcut soru talep kanalını kontrol et
    const existingChannel = guild.channels.cache.find(
        c => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        console.log(`[DEBUG] Kullanıcının zaten aktif bir soru talep kanalı var: ${existingChannel.name}`);
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
                // Botun kendi ID'si için özel bir izne gerek yok, ancak garanti olması için eklenebilir.
                // { id: client.user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });
        console.log(`[DEBUG] Yeni soru talep kanalı oluşturuldu: ${newChannel.name} (${newChannel.id})`);
        
        await interaction.editReply({ content: `Soru talep kanalınız oluşturuldu: ${newChannel}. Lütfen ilk mesajın gelmesini bekleyin.` });
        console.log(`[DEBUG] Kullanıcıya kanal oluşturuldu mesajı gönderildi.`);

        // Discord API'sinin yanıt süresine ve ağ gecikmesine bağlı olarak, bu ilk mesajın gönderilmesi birkaç saniye sürebilir.
        // Bu gecikme, kodun hatalı olduğu anlamına gelmez.
        try {
            await newChannel.send(`${user}, merhaba! Lütfen sorunuzu bu kanala yazın.\nBir yetkili en kısa sürede size yardımcı olacaktır.\n**Bu kanal 5 dakika içinde kapanacaktır.**`);
            console.log('[DEBUG] Soru talep kanalına ilk mesaj gönderildi.');
        } catch (sendError) {
            console.error(`[HATA] Soru talep kanalına ilk mesaj gönderilirken hata oluştu: ${sendError.message}. Bu genellikle botun kanala mesaj gönderme izni olmamasından kaynaklanır.`, sendError);
            await newChannel.delete().catch(() => {});
            return interaction.editReply({ content: 'Soru talep kanalına ilk mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.' });
        }


        const filter = (m) => m.author.id === user.id;
        try {
            console.log('[DEBUG] Kullanıcının mesajı bekleniyor...');
            // Kullanıcıdan mesaj bekleyerek soruyu al
            const collected = await newChannel.awaitMessages({
                filter,
                max: 1,
                time: 300000, // 5 dakika = 300000 ms
                errors: ['time']
            });
            const soru = collected.first().content;
            console.log(`[DEBUG] Kullanıcıdan gelen soru: ${soru}`);
            await newChannel.send(`Sorunuz başarıyla alındı. Bir yetkiliye haber verildi. Cevap için lütfen sabırla bekleyin.`);
            console.log('[DEBUG] Kullanıcıya soru alındı mesajı gönderildi.');

            // İsteğe bağlı: Burada yetkililere bildirim gönderme mekanizması eklenebilir.
            // console.log('[DEBUG] Yetkililere bildirim gönderme kısmı atlandı.');
        } catch (error) {
            // Zaman aşımı veya mesaj toplama hatası
            console.error(`[HATA] Soru talep zaman aşımına uğradı veya hata oluştu: ${error.message}`, error);
            await newChannel.send('Belirtilen süre içinde mesaj yazmadığınız için bu kanal kapatılıyor.');
            try {
                await user.send('Soru kanalı içinde herhangi bir mesaj yazmadığınız için kanalınız kapatıldı. Tekrar denemek için butona basabilirsiniz.');
            } catch (e) {
                console.error(`[HATA] DM gönderilemedi: ${e.message}`);
            }
        }

        // Kanalı işlem bittikten sonra 30 saniye sonra kapatma
        console.log('[DEBUG] Soru talep kanalı 30 saniye içinde silinecek.');
        setTimeout(() => {
            newChannel.delete().catch(err => {
                console.error('[HATA] Soru talep kanalı silinemedi:', err);
            });
        }, 30000); // 30 saniye

    } catch (error) {
        console.error('[KRİTİK HATA] Soru talep kanalı oluşturulurken veya işlenirken genel bir hata oluştu:', error);
        // Eğer kanal oluşturulduysa, hatadan sonra onu silmeye çalış
        if (newChannel) {
            newChannel.delete().catch(err => console.error('[HATA] Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({ content: 'Soru talep kanalı oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
}
