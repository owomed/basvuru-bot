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
                handleBasvuru(interaction);
                break;
            case 'soruTalep':
                // Soru talep butonunu işleyen kısım
                handleSoruTalep(interaction);
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
    let replied = false;
    try {
        await interaction.deferReply({ ephemeral: true });
        replied = true;
    } catch (err) {
        console.error('Başvuru etkileşimi yanıtlanamadı:', err);
        return;
    }

    const { user, customId, guild, client } = interaction;
    const categoryId = '1268509251911811175';

    const basvuruConfig = {
        yetkiliBaşvuru: {
            name: `yetkiliB-${user.username.toLowerCase()}`,
            questions: [
                'İsim ve yaşınız nedir?',
                'Neden bu pozisyona başvuruyorsunuz?',
                'Bir deneyiminiz var mı? Varsa anlatın.',
                'Sunucuda ne kadar aktif olabilirsiniz?',
                'Neden sizi seçmeliyiz?',
            ],
            resultChannelId: '1268544826727600168',
        },
        helperBaşvuru: {
            name: `helperB-${user.username.toLowerCase()}`,
            questions: [
                'İsim ve yaşınız nedir?',
                'Helper deneyiminiz var mı? Varsa anlatın.',
                'Sunucuda ne kadar aktif olabilirsiniz?',
                'OwO bot bilginiz nasıl?',
                'Takım metaları bilginiz nedir?',
            ],
            resultChannelId: '1268544982768160788',
        },
    };

    const config = basvuruConfig[customId];
    if (!config) {
        return replied && interaction.editReply({ content: 'Geçersiz buton etkileşimi.' });
    }

    const existingChannel = guild.channels.cache.find((c) => c.name === config.name);
    if (existingChannel) {
        return replied && interaction.editReply({ content: `Zaten bir başvuru kanalınız var: <#${existingChannel.id}>` });
    }

    try {
        const newChannel = await guild.channels.create(config.name, {
            type: 'GUILD_TEXT', // V13 uyumluluğu için string ifade kullanıldı
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });

        await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**\nKanal 3 dakika içerisinde kapatılacaktır.`);
        if (replied) {
            await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` });
        }

        const responses = [];
        const filter = (m) => m.author.id === user.id;

        for (const [index, q] of config.questions.entries()) {
            await newChannel.send(`**${index + 1}. ${q}**`);
            const collected = await newChannel.awaitMessages({ filter, max: 1, time: 180000, errors: ['time'] })
                .catch(() => {
                    console.log('Başvuru zaman aşımına uğradı.');
                    try {
                        user.send('Başvuru formunu doldurmadığınız için başvuru kanalınız kapatılacaktır.');
                    } catch (e) {
                        console.error(`DM gönderilemedi: ${e.message}`);
                    }
                    newChannel.send('Kanal 3 dakika içinde yanıt alınmadığı için kapatılmıştır.');
                    setTimeout(() => newChannel.delete().catch(() => {}), 30000);
                    return null;
                });

            if (!collected) return;

            const response = collected.first().content;
            responses.push(response);
        }

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

        const resultChannel = client.channels.cache.get(config.resultChannelId);
        if (!resultChannel) {
            console.error(`Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen ID'yi kontrol edin.`);
            await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
            return;
        }

        const sentMessage = await resultChannel.send({ content: '<@&1243478734078742579>', embeds: [embed] });
        await sentMessage.react('<:med_onaylandi:1284130169417764907>');
        await sentMessage.react('<:med_reddedildi:1284130046902145095>');

        const reactionFilter = (reaction, reactor) =>
            ['1284130169417764907', '1284130046902145095'].includes(reaction.emoji.id) &&
            guild.members.cache.get(reactor.id)?.roles.cache.hasAny(
                '1243478734078742579',
                '1216094391060529393',
                '1188389290292551740'
            );

        const reactionCollector = sentMessage.createReactionCollector({ filter: reactionFilter, max: 1, time: 600000 });

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
}

/**
 * Soru talep butonunu işleyen fonksiyon.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleSoruTalep(interaction) {
    let replied = false;
    try {
        await interaction.deferReply({ ephemeral: true });
        replied = true;
    } catch (err) {
        console.error('Soru talep etkileşimi yanıtlanamadı:', err);
        return;
    }

    const { user, guild } = interaction;
    const categoryId = '1268509251911811175';
    const channelName = `soru-talep-${user.username.toLowerCase()}`;
    const existingChannel = guild.channels.cache.find(c => c.name === channelName);

    if (existingChannel) {
        return replied && interaction.editReply({ content: `Zaten bir soru talep kanalınız var: <#${existingChannel.id}>` });
    }

    try {
        const newChannel = await guild.channels.create(channelName, {
            type: 'GUILD_TEXT', // V13 uyumluluğu için string ifade kullanıldı
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
            ],
        });

        await newChannel.send(`${user}, merhaba! Lütfen sorunuzu bu kanala yazın.\nBir yetkili en kısa sürede size yardımcı olacaktır.`);
        if (replied) {
            await interaction.editReply({ content: `Soru talep kanalınız oluşturuldu: ${newChannel}` });
        }

        const filter = (m) => m.author.id === user.id;
        await newChannel.awaitMessages({ filter, max: 1, time: 300000, errors: ['time'] })
            .then(collected => {
                const soru = collected.first().content;
                console.log(`Kullanıcıdan gelen soru: ${soru}`);
                newChannel.send(`Sorunuz alındı. Bir yetkiliye haber verildi. Cevap için lütfen sabırla bekleyin.`);
            })
            .catch(() => {
                try {
                    user.send('Soru kanalı içinde herhangi bir mesaj yazmadığınız için kanalınız kapatılacaktır.');
                } catch (e) {
                    console.error(`DM gönderilemedi: ${e.message}`);
                }
                newChannel.send('Kanal 5 dakika içinde yanıt alınmadığı için kapatılmıştır.');
            });

        setTimeout(() => {
            newChannel.delete().catch(err => {
                console.error('Soru talep kanalı silinemedi:', err);
            });
        }, 30000);

    } catch (error) {
        console.error('Soru talep kanalı oluşturulurken veya işlenirken hata oluştu:', error);
        if (replied) {
            await interaction.editReply({ content: 'Soru talep kanalı oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
        } else {
            try {
                await interaction.followUp({ content: 'Soru talep kanalı oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.', ephemeral: true });
            } catch (followUpError) {
                console.error('Follow-up yanıtı da gönderilemedi:', followUpError);
            }
        }
    }
    }
    
