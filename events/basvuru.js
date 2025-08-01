const { MessageEmbed, Permissions, ChannelType } = require('discord.js');

// Config dosyasına gerek yok, ID'leri .env'den alıyoruz.

module.exports = {
    // Bu olayın adı "interactionCreate" olacak, çünkü bu bir interaction (buton) olayıdır.
    name: 'interactionCreate',
    
    // Olay çalıştığında çağrılacak fonksiyon.
    // interaction objesi Discord.js tarafından otomatik olarak sağlanır.
    async execute(interaction) {
        // Sadece buton etkileşimlerini dinle
        if (!interaction.isButton()) return;

        // Discord'a hızlıca yanıt veriyoruz, bu hatayı önlemek için çok önemli.
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (err) {
            console.error('Interaction yanıtlanamadı (zaman aşımı veya botun yetkisi yok):', err);
            return;
        }

        const { user, customId, guild, client } = interaction;
        const categoryId = process.env.BASVURU_KATEGORI_ID; // Kategori ID'si .env'den çekilmeli

        // Başvuru türüne göre yapılandırma
        const basvuruConfig = {
            yetkiliBaşvuru: {
                name: `yetkili-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, // Kullanıcı adını sanitize et
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Neden bu pozisyona başvuruyorsunuz?',
                    'Bir deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'Neden sizi seçmeliyiz?',
                ],
                resultChannelId: process.env.RESULT_CHANNEL_ID_YETKILI,
            },
            helperBaşvuru: {
                name: `helper-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, // Kullanıcı adını sanitize et
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Helper deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'OwO bot bilginiz nasıl?',
                    'Takım metaları bilginiz nedir?',
                ],
                resultChannelId: process.env.RESULT_CHANNEL_ID_HELPER,
            },
        };

        const config = basvuruConfig[customId];
        if (!config) {
            return interaction.editReply({ content: 'Geçersiz buton etkileşimi.' }).catch(console.error);
        }

        // Kategori ID'sinin tanımlı olduğundan emin ol
        if (!categoryId) {
            console.error('.env dosyasında BASVURU_KATEGORI_ID tanımlı değil!');
            return interaction.editReply({ content: 'Hata: Kategori ID\'si yapılandırılmamış.' }).catch(console.error);
        }

        // Mevcut başvuru kanalı olup olmadığını kontrol et
        const existingChannel = guild.channels.cache.find((c) => c.name === config.name && c.type === ChannelType.GuildText);
        if (existingChannel) {
            return interaction.editReply({ content: `Zaten bir başvuru kanalınız var: <#${existingChannel.id}>` }).catch(console.error);
        }

        try {
            // Kanal oluşturma ve izinleri ayarlama
            const newChannel = await guild.channels.create({
                name: config.name,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                    { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
                ],
            });

            // Kullanıcıya bilgi mesajı gönder
            await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` }).catch(console.error);

            // Başvuru kanalına soruları gönder
            await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**`);
            for (const q of config.questions) {
                await newChannel.send(`**${q}**`);
            }
            await newChannel.send('Kanal 3 dakika boyunca bir mesaj gönderilmezse kapatılacaktır.');

            const filter = (m) => m.author.id === user.id;
            const collector = newChannel.createMessageCollector({ filter, time: 180000 }); // 3 dakika = 180000 ms
            const responses = [];

            collector.on('collect', (m) => responses.push(m.content));

            collector.on('end', async () => {
                if (responses.length === 0) {
                    try {
                        await user.send('Başvuru formunuzu doldurmadığınız için başvuru kanalınız kapatılacaktır.');
                    } catch (e) {
                        console.error(`DM gönderilemedi: ${e.message}`);
                    }
                    await newChannel.send('Kanal 3 dakika içinde yanıt alınmadığı için kapatılmıştır.');
                    setTimeout(() => newChannel.delete().catch(() => {}), 30000); // 30 saniye sonra sil
                    return;
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
                    console.error(`Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen .env dosyasını kontrol edin.`);
                    await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
                    return;
                }

                // Yetkili rol ID'leri de .env'den çekilmeli
                const yetkiliRoleId = process.env.YETKILI_ROLE_ID; 
                if (!yetkiliRoleId) {
                    console.error('.env dosyasında YETKILI_ROLE_ID tanımlı değil!');
                    return newChannel.send('Hata: Yetkili rol ID\'si yapılandırılmamış.').catch(console.error);
                }

                const sentMessage = await resultChannel.send({ content: `<@&${yetkiliRoleId}>`, embeds: [embed] });

                // Emoji ID'leri de .env'den çekilmeli
                const emojiOnayId = process.env.EMOJI_ONAY_ID;
                const emojiRedId = process.env.EMOJI_RED_ID;

                if (emojiOnayId && emojiRedId) {
                    await sentMessage.react(emojiOnayId);
                    await sentMessage.react(emojiRedId);
                }

                const reactionFilter = (reaction, reactor) =>
                    [emojiOnayId, emojiRedId].includes(reaction.emoji.id) &&
                    guild.members.cache.get(reactor.id)?.roles.cache.hasAny(
                        process.env.YETKILI_ROLE_ID,
                        process.env.YETKILI_ROLE_ID_2,
                        process.env.YETKILI_ROLE_ID_3
                    );

                const reactionCollector = sentMessage.createReactionCollector({ filter: reactionFilter, max: 1, time: 600000 }); // 10 dakika süre

                reactionCollector.on('collect', async (reaction, reactor) => {
                    const onay = reaction.emoji.id === emojiOnayId;
                    const başvuruTürü = customId === 'yetkiliBaşvuru' ? 'Yetkili' : 'Helper';

                    const sonuçEmbed = new MessageEmbed()
                        .setTitle('Başvurunuz sonuçlandı')
                        .setAuthor('MED Başvuru')
                        .setDescription(
                            `\`Başvuru yapan:\` \n${user}\n` +
                            `${başvuruTürü} başvurunuz <@${reactor.id}> kişisi tarafından ${onay ? `onaylandı <:${reaction.emoji.name}:${emojiOnayId}>` : `reddedildi <:${reaction.emoji.name}:${emojiRedId}>`}`
                        )
                        .setColor(onay ? '#00ff00' : '#ff0000')
                        .setFooter({ text: `${guild.name} � | ${başvuruTürü} Başvurusu`, iconURL: guild.iconURL() });

                    const complaintChannelId = process.env.COMPLAINT_CHANNEL_ID;
                    const sonuçKanalı = client.channels.cache.get(complaintChannelId);
                    if (sonuçKanalı) {
                        await sonuçKanalı.send({ embeds: [sonuçEmbed] });
                    } else {
                        console.error(`Sonuç kanalı (COMPLAINT_CHANNEL_ID) bulunamadı: ${complaintChannelId}. Lütfen .env dosyasını kontrol edin.`);
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
            });

        } catch (error) {
            console.error('Başvuru kanalı oluşturulurken veya işlenirken hata oluştu:', error);
            // Hata oluştuğunda kullanıcıya bilgi ver
            await interaction.editReply({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' }).catch(console.error);
        }
    },
};
