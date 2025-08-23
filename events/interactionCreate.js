// Bu dosya `./events/` klasörüne taşınmalıdır.
// Bu dosya hem başvuru, hem soru talep, hem de şikayet (ticket) butonlarını işler.
// Discord.js v14 ile uyumludur.

const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType,
    Events,
} = require('discord.js');

module.exports = {
    // Bu dosyanın dinleyeceği olay 'interactionCreate'
    name: Events.InteractionCreate,
    // Etkileşim olduğunda çalışacak asenkron fonksiyon
    async execute(interaction) {

        // Sadece buton ve modal etkileşimlerini dinle, diğerlerini yok say.
        if (!interaction.isButton() && !interaction.isModalSubmit()) {
            return;
        }

        // --- BUTON ETKİLEŞİMLERİ İŞLEME KISMI ---
        if (interaction.isButton()) {
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
                case 'görüş':
                    // Üst yetkiliyle görüşme butonu
                    await handleGorus(interaction);
                    break;
                default:
                    // Tanımsız butonları görmezden gel
                    return;
            }
        }

        // --- MODAL ETKİLEŞİMLERİ İŞLEME KISMI ---
        if (interaction.isModalSubmit()) {
            switch (interaction.customId) {
                case 'yetkili-basvuru-modal':
                case 'helper-basvuru-modal':
                    // Başvuru modalını işleyen kısım
                    await processBasvuruModal(interaction);
                    break;
                case 'soru-talep-modal':
                    // Soru talep modalını işleyen kısım
                    await processSoruTalepModal(interaction);
                    break;
                case 'gorus-modal':
                    // Görüşme modalını işleyen kısım
                    await processGorusModal(interaction);
                    break;
                default:
                    // Tanımsız modalları görmezden gel
                    return;
            }
        }
    },
};

/**
 * Başvuru butonları tıklandığında modalı (formu) gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleBasvuru(interaction) {
    const {
        customId
    } = interaction;

    // Debug için butondan gelen customId'yi logla
    console.log(`[DEBUG] handleBasvuru - Gelen butondaki customId: ${customId}`);

    if (!customId) {
        console.error('[HATA] Buton customId\'si bulunamadı. Lütfen buton oluşturma kodunu kontrol edin.');
        return;
    }

    const basvuruTuru = customId.includes('yetkili') ? 'Yetkili' : 'Helper';
    const modalCustomId = customId.replace('Başvuru', '-basvuru-modal');

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(`${basvuruTuru} Başvuru Formu`);

    const questions = {
        yetkiliBaşvuru: [{
            id: 'isim-yas-input',
            label: 'İsim ve yaşınız nedir?',
            required: true,
            style: 'short'
        }, {
            id: 'neden-basvuru-input',
            label: 'Neden bu pozisyona başvuruyorsunuz?',
            required: true,
            style: 'paragraph'
        }, {
            id: 'deneyim-input',
            label: 'Bir deneyiminiz var mı? Varsa anlatın.',
            required: false,
            style: 'paragraph'
        }, {
            id: 'aktiflik-input',
            label: 'Sunucuda ne kadar aktif olabilirsiniz?',
            required: true,
            style: 'short'
        }, {
            id: 'neden-secilmeli-input',
            label: 'Neden sizi seçmeliyiz?',
            required: true,
            style: 'paragraph'
        }],
        helperBaşvuru: [{
            id: 'isim-yas-input',
            label: 'İsim ve yaşınız nedir?',
            required: true,
            style: 'short'
        }, {
            id: 'helper-deneyim-input',
            label: 'Helper deneyiminiz var mı? Varsa anlatın.',
            required: false,
            style: 'paragraph'
        }, {
            id: 'aktiflik-input',
            label: 'Sunucuda ne kadar aktif olabilirsiniz?',
            required: true,
            style: 'short'
        }, {
            id: 'owo-bilgi-input',
            label: 'OwO bot bilginiz nasıl?',
            required: true,
            style: 'short'
        }, {
            id: 'takim-meta-input',
            label: 'Takım metası bilginiz nedir?',
            required: true,
            style: 'paragraph'
        }]
    };

    const textInputs = questions[customId].map(q =>
        new TextInputBuilder()
        .setCustomId(q.id)
        .setLabel(q.label)
        .setStyle(q.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setRequired(q.required)
    );

    // Tüm text inputları action row'lara ekle
    textInputs.forEach(input => modal.addComponents(new ActionRowBuilder().addComponents(input)));

    // Modal'ı kullanıcıya göster. Bu, buton tıklamasına doğrudan bir yanıttır ve önceden herhangi bir deferReply veya deferUpdate yapılmamalıdır.
    try {
        await interaction.showModal(modal);
        console.log(`[DEBUG] Başvuru modalı kullanıcıya gösterildi: ${modal.customId}`);
    } catch (e) {
        console.error('[HATA] Başvuru modalı gösterilirken hata oluştu:', e);
        // Bu hata genellikle 3 saniyelik zaman aşımı nedeniyle oluşur.
        // Hata durumunda kullanıcıya bilgilendirici bir mesaj gönderilir.
        try {
            // "ephemeral" bayrağı kullanmak yerine "flags" ile belirttik.
            await interaction.reply({
                content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: true
            });
        } catch (replyError) {
            console.error('[HATA] Hata mesajı gönderilemedi:', replyError);
        }
    }
}

/**
 * Başvuru modalı doldurulup gönderildiğinde işler.
 * Bu versiyonda kanal oluşturmak yerine doğrudan sonuç kanalına gönderim yapılır.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processBasvuruModal(interaction) {
    await interaction.deferReply({
        flags: 64
    });
    const {
        user,
        customId,
        guild,
        client
    } = interaction;

    const basvuruConfig = {
        'yetkili-basvuru-modal': {
            namePrefix: 'yetkili-b-',
            resultChannelId: '1268544826727600168',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'],
            applicationType: 'Yetkili',
            modalValues: [{
                id: 'isim-yas-input',
                label: 'İsim ve yaşınız nedir?'
            }, {
                id: 'neden-basvuru-input',
                label: 'Neden bu pozisyona başvuruyorsunuz?'
            }, {
                id: 'deneyim-input',
                label: 'Bir deneyiminiz var mı?'
            }, {
                id: 'aktiflik-input',
                label: 'Sunucuda ne kadar aktif olabilirsiniz?'
            }, {
                id: 'neden-secilmeli-input',
                label: 'Neden sizi seçmeliyiz?'
            }]
        },
        'helper-basvuru-modal': {
            namePrefix: 'helper-b-',
            resultChannelId: '1268544982768160788',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'],
            applicationType: 'Helper',
            modalValues: [{
                id: 'isim-yas-input',
                label: 'İsim ve yaşınız nedir?'
            }, {
                id: 'helper-deneyim-input',
                label: 'Helper deneyiminiz var mı?'
            }, {
                id: 'aktiflik-input',
                label: 'Sunucuda ne kadar aktif olabilirsiniz?'
            }, {
                id: 'owo-bilgi-input',
                label: 'OwO bot bilginiz nasıl?'
            }, {
                id: 'takim-meta-input',
                label: 'Takım metası bilginiz nedir?'
            }]
        }
    };

    const config = basvuruConfig[customId];
    if (!config) {
        console.error(`[HATA] Geçersiz modal ID: ${customId}`);
        return interaction.editReply({
            content: 'Geçersiz bir başvuru türüyle karşılaşıldı. Lütfen bot sahibine bildirin.'
        });
    }

    const CATEGORY_ID = '1268509251911811175';

    // Başvuru sonuçlarını içeren embed oluştur
    const embed = new EmbedBuilder()
        .setTitle(`${config.applicationType} Başvuru`)
        .setAuthor({
            name: user.tag,
            iconURL: user.displayAvatarURL()
        })
        .setDescription(`**Başvuru Yapan:** ${user}`)
        .addFields(
            config.modalValues.map(q => ({
                name: `❓ ${q.label}`,
                value: interaction.fields.getTextInputValue(q.id) || 'Cevap verilmedi',
                inline: false,
            }))
        )
        .setColor('#0099ff')
        .setFooter({
            text: `${guild.name} | ${config.applicationType} Başvurusu`,
            iconURL: guild.iconURL()
        })
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    // Sonuç kanalına embed'i gönder
    const resultChannel = client.channels.cache.get(config.resultChannelId);
    if (!resultChannel) {
        console.error(`[KRİTİK HATA] Sonuç kanalı bulunamadı: ${config.resultChannelId}`);
        return interaction.editReply({
            content: 'Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.'
        });
    }

    // Özel emojilerin ID'leri
    const EMOJI_ONAY_ID = '1284130169417764907';
    const EMOJI_RED_ID = '1284130046902145095';

    const sentMessage = await resultChannel.send({
        content: `<@&1243478734078742579>`, // Yetkili rolünü etiketle
        embeds: [embed]
    });

    // Emojileri tepki olarak ekle
    await sentMessage.react(EMOJI_ONAY_ID);
    await sentMessage.react(EMOJI_RED_ID);

    // Başvurunun durumunu takip etmek için özel bir filtre oluştur
    const filter = (reaction, reactor) => {
        console.log(`[DEBUG] Reaksiyon filtresi tetiklendi.`);
        const isCorrectEmoji = reaction.emoji.id === EMOJI_ONAY_ID || reaction.emoji.id === EMOJI_RED_ID;
        console.log(`[DEBUG] Emoji doğru mu? ${isCorrectEmoji}`);
        
        const member = interaction.guild.members.cache.get(reactor.id);
        console.log(`[DEBUG] Reaksiyonu yapan kullanıcının ID'si: ${reactor.id}, Üye nesnesi bulundu mu? ${!!member}`);

        const isAuthorizedUser = member && config.requiredRoles.some(roleId => member.roles.cache.has(roleId));
        console.log(`[DEBUG] Kullanıcı yetkili mi? ${isAuthorizedUser}`);

        return isCorrectEmoji && isAuthorizedUser;
    };


    // Mesaj üzerinde reaksiyonları bekle
    const collector = sentMessage.createReactionCollector({
        filter,
        max: 1,
        time: 3600000
    }); // 1 saat bekleme süresi

    collector.on('collect', async (reaction, reactor) => {
        console.log(`[DEBUG] Reaksiyon toplandı! Kullanıcı: ${reactor.tag}`);

        const isApproved = reaction.emoji.id === EMOJI_ONAY_ID;
        const statusText = isApproved ? 'ONAYLANDI' : 'REDDEDİLDİ';

        const finalEmbed = new EmbedBuilder()
            .setTitle(`${config.applicationType} Başvuru`)
            .setAuthor({
                name: user.tag, // Başvuru yapan kullanıcının etiketini kullan
                iconURL: user.displayAvatarURL()
            })
            .setDescription(`**Başvuru Sonuçlandı!**`)
            .addFields({
                name: `Başvuru Durumu`,
                value: `Başvurunuz, <@${reactor.id}> tarafından **${statusText}**`
            })
            .setColor(isApproved ? '#2ecc71' : '#e74c3c')
            .setFooter({
                text: `${guild.name}`,
                iconURL: guild.iconURL()
            })
            .setTimestamp();

        // Başvuru sonuç kanalına final mesajını gönder
        console.log(`[DEBUG] Sonuç mesajı gönderiliyor. Sonuç kanalı ID: 1277638999464214558`);
        const finalResultChannel = client.channels.cache.get('1277638999464214558');

        if (finalResultChannel) {
            try {
                await finalResultChannel.send({
                    content: `**Başvuru Sonuçlandı!**`,
                    embeds: [finalEmbed]
                });
                console.log(`[DEBUG] Sonuç mesajı başarıyla gönderildi.`);
            } catch (error) {
                console.error(`[HATA] Sonuç mesajı gönderilemedi! Hata:`, error);
            }
        } else {
            console.error('[KRİTİK HATA] Sonuç kanalı bulunamadı!');
        }

        // Orijinal başvuru mesajındaki emojileri kaldır
        await sentMessage.reactions.removeAll().catch(error => console.error('Emojiler kaldırılamadı:', error));
    });

    collector.on('end', collected => {
        console.log(`[DEBUG] Toplayıcı sona erdi. Toplanan reaksiyon sayısı: ${collected.size}`);
        if (collected.size === 0) {
            // Süre dolduğunda veya toplanan reaksiyon olmadığında
            sentMessage.reactions.removeAll().catch(error => console.error('Emojiler kaldırılamadı:', error));
        }
    });

    // Kullanıcıya başvurunun alındığını bildir
    await interaction.editReply({
        content: `Başvurunuz başarıyla alındı. Lütfen yetkililerin yanıtını bekleyin.`
    });
}

/**
 * Soru talep butonu tıklandığında modalı (formu) gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleSoruTalep(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('soru-talep-modal')
        .setTitle('Soru Talep Formu');

    const questionInput = new TextInputBuilder()
        .setCustomId('soru-input')
        .setLabel('Sorunuzu buraya yazın')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(questionInput));

    try {
        await interaction.showModal(modal);
    } catch (e) {
        await interaction.reply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
        });
    }
}

/**
 * Soru talep modalı doldurulup gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processSoruTalepModal(interaction) {
    await interaction.deferReply({
        flags: 64
    });
    const {
        user,
        guild
    } = interaction;
    const soru = interaction.fields.getTextInputValue('soru-input');

    const CATEGORY_ID = '1268509251911811175';

    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `soru-talep-${cleanUsername}`;

    const existingChannel = guild.channels.cache.find(
        c => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({
            content: `Zaten aktif bir soru talep kanalınız var: <#${existingChannel.id}>`
        });
    }

    let newChannel;
    try {
        newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [{
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            }, {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }, ],
        });

        const soruEmbed = new EmbedBuilder()
            .setTitle('Soru Talebi')
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL()
            })
            .setDescription(`**Soru Soran:** ${user}\n**Soru:**\n${soru}`)
            .setColor('#3498db')
            .setTimestamp();

        // Yetkili rolünü etiketle ve embed'i gönder
        await newChannel.send({
            content: `Merhaba yetkililer, <@${user.id}> adlı kullanıcının bir soru talebi var.`,
            embeds: [soruEmbed]
        });

        await interaction.editReply({
            content: `Soru talep kanalınız oluşturuldu: ${newChannel}. Bir yetkili en kısa sürede size yardımcı olacaktır.`
        });

        // Kanalı 5 dakika sonra kapatma
        setTimeout(() => {
            newChannel.delete().catch(err => {
                console.error('[HATA] Soru talep kanalı silinemedi:', err);
            });
        }, 300000); // 5 dakika = 300000 ms

    } catch (error) {
        console.error('[KRİTİK HATA] Soru talep kanalı oluşturulurken veya işlenirken hata:', error);
        if (newChannel) {
            newChannel.delete().catch(err => console.error('[HATA] Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({
            content: 'Soru talep kanalı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
        });
    }
}

/**
 * Üst yetkiliyle görüşme butonu tıklandığında modalı (formu) gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleGorus(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('gorus-modal')
        .setTitle('Üst Yetkiliyle Görüşme Talebi');

    const konuInput = new TextInputBuilder()
        .setCustomId('konu-input')
        .setLabel('Görüşme konunuz nedir?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const detayInput = new TextInputBuilder()
        .setCustomId('detay-input')
        .setLabel('Detaylı açıklamanız.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(konuInput),
        new ActionRowBuilder().addComponents(detayInput)
    );

    try {
        await interaction.showModal(modal);
    } catch (e) {
        await interaction.reply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
        });
    }
}

/**
 * Görüşme modalı doldurulup gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processGorusModal(interaction) {
    await interaction.deferReply({
        flags: 64
    });
    const {
        user,
        guild
    } = interaction;
    const konu = interaction.fields.getTextInputValue('konu-input');
    const detay = interaction.fields.getTextInputValue('detay-input');

    const CATEGORY_ID = '1268509251911811175';

    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `gorus-${cleanUsername}`;

    const existingChannel = guild.channels.cache.find(
        c => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({
            content: `Zaten aktif bir görüşme kanalınız var: <#${existingChannel.id}>`
        });
    }

    let newChannel;
    try {
        newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [{
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            }, {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }, {
                id: '1243478734078742579', // Üst yetkili rolü
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }],
        });

        const gorusEmbed = new EmbedBuilder()
            .setTitle('Üst Yetkiliyle Görüşme Talebi')
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL()
            })
            .setDescription(`**Görüşme Talep Eden:** ${user}\n**Konu:** ${konu}\n**Detay:**\n${detay}`)
            .setColor('#e74c3c')
            .setTimestamp();

        // Yetkili rolünü etiketle ve embed'i gönder
        await newChannel.send({
            content: `<@&1243478734078742579> Yeni bir görüşme talebi var.`,
            embeds: [gorusEmbed]
        });

        await interaction.editReply({
            content: `Üst yetkiliyle görüşme kanalınız oluşturuldu: ${newChannel}. Lütfen yetkililerin yanıtını bekleyin.`
        });

        // Kanalı 30 dakika sonra kapatma
        setTimeout(() => {
            newChannel.delete().catch(err => {
                console.error('[HATA] Görüşme kanalı silinemedi:', err);
            });
        }, 1800000); // 30 dakika = 1800000 ms

    } catch (error) {
        console.error('[KRİTİK HATA] Görüşme kanalı oluşturulurken veya işlenirken hata:', error);
        if (newChannel) {
            newChannel.delete().catch(err => console.error('[HATA] Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({
            content: 'Görüşme kanalı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
        });
    }
}