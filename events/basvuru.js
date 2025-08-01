// Bu dosya `./events/` klasörüne taşınmalıdır.
// Örneğin: `./events/basvuru.js`

// discord.js kütüphanesinden gerekli sınıfları içe aktarıyoruz
const { MessageEmbed, Permissions, ChannelType } = require('discord.js');

// Bu dosya için `.env` veya `config.json` dosyasına ihtiyaç yok,
// çünkü bu veriler botun ana dosyası tarafından zaten yüklendi.

module.exports = {
    // Bu olayın adı "interactionCreate" olacak, çünkü bu bir interaction (buton) olayıdır.
    name: 'interactionCreate',

    // Olay çalıştığında çağrılacak asenkron fonksiyon
    async execute(interaction) {
        // Sadece buton etkileşimlerini dinle, diğer etkileşimleri yok say.
        if (!interaction.isButton()) return;

        // Başvuru butonlarının customId'lerini kontrol ederek sadece bu dosyanın işleyeceği butonları belirle
        // Bu, birden fazla `interactionCreate` dosyası olduğunda çakışmayı önler.
        const handledButtons = ['yetkiliBaşvuru', 'helperBaşvuru'];
        if (!handledButtons.includes(interaction.customId)) {
            return; // Bu buton bu dosya tarafından işlenmiyor, çıkış yap.
        }

        let replied = false;
        try {
            // Yanıt verme süresi dolmadan yanıtı ertele (kullanıcıya botun çalıştığını gösterir)
            await interaction.deferReply({ ephemeral: true });
            replied = true;
        } catch (err) {
            console.error('Interaction yanıtlanamadı, zaman aşımına uğramış olabilir.', err);
            return;
        }

        const { user, customId, guild, client } = interaction;
        // Başvuru kanallarının oluşturulacağı kategori ID'si (Sabit kalabilir)
        const categoryId = '1268509251911811175';

        // Başvuru türüne göre yapılandırma
        const basvuruConfig = {
            yetkiliBaşvuru: {
                name: `yetkiliB-${user.username.toLowerCase()}`, // Yeni kanal adlandırma kuralı
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Neden bu pozisyona başvuruyorsunuz?',
                    'Bir deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'Neden sizi seçmeliyiz?',
                ],
                resultChannelId: '1268544826727600168', // Yetkili başvuru sonuç kanalı ID'si
            },
            helperBaşvuru: {
                name: `helperB-${user.username.toLowerCase()}`, // Yeni kanal adlandırma kuralı
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Helper deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'OwO bot bilginiz nasıl?',
                    'Takım metaları bilginiz nedir?',
                ],
                resultChannelId: '1268544982768160788', // Helper başvuru sonuç kanalı ID'si
            },
        };

        const config = basvuruConfig[customId];
        if (!config) {
            return replied && interaction.editReply({ content: 'Geçersiz buton etkileşimi.' });
        }

        // Kullanıcının daha önce bir başvuru kanalı olup olmadığını kontrol et
        const existingChannel = guild.channels.cache.find((c) => c.name === config.name);
        if (existingChannel) {
            return replied && interaction.editReply({ content: `Zaten bir başvuru kanalınız var: <#${existingChannel.id}>` });
        }

        try {
            // Kanal oluşturulurken modern ChannelType.GuildText kullanıldı.
            const newChannel = await guild.channels.create({
                name: config.name,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    // `@everyone` rolünün kanalı görmesini engelle
                    { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                    // Başvuru yapan kullanıcının kanalı görmesine ve mesaj göndermesine izin ver
                    { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
                ],
            });

            // Kullanıcıya karşılama mesajı ve talimatları gönder
            await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**\nKanal 3 dakika içerisinde kapatılacaktır.`);
            if (replied) {
                await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` });
            }

            const responses = [];
            // Sadece başvuru yapan kullanıcının mesajlarını dinle
            const filter = (m) => m.author.id === user.id;

            // Her soru için teker teker yanıt bekleme
            for (const [index, q] of config.questions.entries()) {
                await newChannel.send(`**${index + 1}. ${q}**`);
                const collected = await newChannel.awaitMessages({ filter, max: 1, time: 180000, errors: ['time'] })
                    .catch(() => {
                        console.log('Başvuru zaman aşımına uğradı.');
                        // Zaman aşımı durumunda kullanıcıya DM gönder ve kanalı kapat
                        try {
                            user.send('Başvuru formunu doldurmadığınız için başvuru kanalınız kapatılacaktır.');
                        } catch (e) {
                            console.error(`DM gönderilemedi: ${e.message}`);
                        }
                        newChannel.send('Kanal 3 dakika içinde yanıt alınmadığı için kapatılmıştır.');
                        setTimeout(() => newChannel.delete().catch(() => {}), 30000);
                        return null; // Döngüyü kırmak için null döndür
                    });

                if (!collected) return; // Zaman aşımı veya hata durumunda işlemi durdur

                const response = collected.first().content;
                responses.push(response);
            }

            // Eğer tüm sorulara cevap verilmişse formu gönder
            const embed = new MessageEmbed()
                .setTitle(customId === 'yetkiliBaşvuru' ? 'Yetkili Başvuru' : 'Helper Başvuru')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setDescription(`**Başvuru yapan:** ${user}`)
                .addFields(
                    config.questions.map((q, i) => ({
                        name: `❓ ${q}`,
                        value: responses[i] || 'Cevap verilmedi',
                        inline: false,
                    }))
                )
                .setColor('#0099ff')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            // Sonuç kanalını `.env` dosyası yerine sabit ID'den al
            const resultChannel = client.channels.cache.get(config.resultChannelId);
            if (!resultChannel) {
                console.error(`Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen ID'yi kontrol edin.`);
                await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
                return;
            }

            // Başvuru sonuçlarını sonuç kanalına gönder ve yetkili rolünü etiketle
            const sentMessage = await resultChannel.send({ content: '<@&1243478734078742579>', embeds: [embed] }); // Yetkili rol ID'si

            // Onay ve red emojilerini ekle
            await sentMessage.react('<:med_onaylandi:1284130169417764907>');
            await sentMessage.react('<:med_reddedildi:1284130046902145095>');

            // Sadece yetkili rollere sahip kişilerin tepkilerini dinle
            const reactionFilter = (reaction, reactor) =>
                ['1284130169417764907', '1284130046902145095'].includes(reaction.emoji.id) &&
                guild.members.cache.get(reactor.id)?.roles.cache.hasAny(
                    '1243478734078742579', // Yetkili rolü ID'si
                    '1216094391060529393', // Başka bir yetkili rolü ID'si
                    '1188389290292551740'  // Başka bir yetkili rolü ID'si
                );

            const reactionCollector = sentMessage.createReactionCollector({ filter: reactionFilter, max: 1, time: 600000 }); // 10 dakika süre

            reactionCollector.on('collect', async (reaction, reactor) => {
                const onay = reaction.emoji.id === '1284130169417764907';
                const başvuruTürü = customId === 'yetkiliBaşvuru' ? 'Yetkili' : 'Helper';

                const sonuçEmbed = new MessageEmbed()
                    .setTitle('Başvurunuz sonuçlandı')
                    .setAuthor({ name: 'MED Başvuru' })
                    .setDescription(
                        `\`Başvuru yapan:\` \n${user}\n` +
                        `${başvuruTürü} başvurunuz <@${reactor.id}> kişisi tarafından ${onay ? 'onaylandı <:med_onaylandi:1284130169417764907>' : 'reddedildi <:med_reddedildi:1284130046902145095>'}`
                    )
                    .setColor(onay ? '#00ff00' : '#ff0000')
                    .setFooter({ text: `${guild.name} 🤍 | ${başvuruTürü} Başvurusu`, iconURL: guild.iconURL() });

                // Sonuç kanalını sabit ID'den al
                const sonuçKanalı = client.channels.cache.get('1277638999464214558');
                if (sonuçKanalı) {
                    await sonuçKanalı.send({ embeds: [sonuçEmbed] });
                } else {
                    console.error('Sonuç kanalı (1277638999464214558) bulunamadı. Lütfen IDyi kontrol edin.');
                }

                try {
                    await sentMessage.reactions.removeAll();
                } catch (error) {
                    console.error('Mesajdaki emojiler kaldırılamadı:', error);
                }
            });

            reactionCollector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    console.log('Başvuru mesajına yetkili tarafından tepki verilmediği için zaman aşımına uğradı.');
                }
            });

            // Başvuru tamamlandıktan sonra kanalı sil
            await newChannel.send('Başvurunuz alınmıştır. Kanal 5 saniye içinde siliniyor.');
            setTimeout(() => newChannel.delete().catch(() => {}), 5000);

        } catch (error) {
            console.error('Başvuru kanalı oluşturulurken veya işlenirken hata oluştu:', error);
            if (replied) {
                await interaction.editReply({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
            } else {
                try {
                    await interaction.followUp({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.', ephemeral: true });
                } catch (followUpError) {
                    console.error('Follow-up yanıtı da gönderilemedi:', followUpError);
                }
            }
        }
    },
};
