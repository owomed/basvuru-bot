// Bu dosya, Discord.js v14 kullanarak çeşitli interaksiyonları yönetir:
// Buton tıklamaları, modal gönderimleri ve reaksiyon kolektörleri.

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType,
    Events,
} = require('discord.js');

// Discord.js'in "interactionCreate" olayını dinleyecek modül.
module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // Sadece buton ve modal etkileşimlerini işleme al, diğerlerini yok say.
        if (!interaction.isButton() && !interaction.isModalSubmit()) {
            return;
        }

        // --- BUTON ETKİLEŞİMLERİ İŞLEME KISMI ---
        if (interaction.isButton()) {
            switch (interaction.customId) {
                // LÜTFEN AŞAĞIDAKİ CUSTOM ID'LERİ KENDİ BUTON ID'LERİNLE DEĞİŞTİR!
                case 'yetkiliBaşvuru': // KONSOLDA GÖRÜNEN BUTON ID'SİNE GÖRE GÜNCELLENDİ
                case 'helperBaşvuru': // KONSOLDA GÖRÜNEN BUTON ID'SİNE GÖRE GÜNCELLENDİ
                    await handleBasvuruButton(interaction);
                    break;
                // LÜTFEN AŞAĞIDAKİ CUSTOM ID'Yİ KENDİ BUTON ID'NLE DEĞİŞTİR!
                case 'görüş': // KONSOLDA GÖRÜNEN BUTON ID'SİNE GÖRE GÜNCELLENDİ
                    await handleGorusmeButton(interaction);
                    break;
                // Kanal kapatma butonu
                case 'close-gorusme-channel':
                    await handleCloseChannelButton(interaction);
                    break;
                default:
                    // Tanımsız butonları görmezden gel ve konsola yazdır.
                    console.log(`[HATA AYIKLAMA] Tanınmayan Buton ID: ${interaction.customId}`);
                    return;
            }
        }

        // --- MODAL ETKİLEŞİMLERİ İŞLEME KISMI ---
        if (interaction.isModalSubmit()) {
            switch (interaction.customId) {
                // Başvuru modalı
                case 'yetkili-basvuru-modal':
                case 'helper-basvuru-modal':
                    await processBasvuruModal(interaction);
                    break;
                // Görüşme modalı
                case 'gorusme-modal':
                    await processGorusmeModal(interaction);
                    break;
                default:
                    // Tanımsız modalları görmezden gel
                    return;
            }
        }
    },
};

/**
 * Başvuru butonları tıklandığında ilgili modalı (formu) gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleBasvuruButton(interaction) {
    const {
        customId
    } = interaction;
    const basvuruTuru = customId.includes('yetkili') ? 'Yetkili' : 'Helper';
    const modalCustomId = customId.includes('yetkili') ? 'yetkili-basvuru-modal' : 'helper-basvuru-modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(`${basvuruTuru} Başvuru Formu`);

    const questions = {
        'yetkiliBaşvuru': [{
            id: 'isim-yas',
            label: 'İsim ve yaşınız nedir?',
            required: true,
            style: TextInputStyle.Short
        }, {
            id: 'neden-basvuru',
            label: 'Neden bu pozisyona başvuruyorsunuz?',
            required: true,
            style: TextInputStyle.Paragraph
        }, {
            id: 'deneyim',
            label: 'Bir deneyiminiz var mı? Varsa anlatın.',
            required: false,
            style: TextInputStyle.Paragraph
        }, {
            id: 'aktiflik',
            label: 'Sunucuda ne kadar aktif olabilirsiniz?',
            required: true,
            style: TextInputStyle.Short
        }, {
            id: 'neden-secilmeli',
            label: 'Neden sizi seçmeliyiz?',
            required: true,
            style: TextInputStyle.Paragraph
        }],
        'helperBaşvuru': [{
            id: 'isim-yas',
            label: 'İsim ve yaşınız nedir?',
            required: true,
            style: TextInputStyle.Short
        }, {
            id: 'helper-deneyim',
            label: 'Helper deneyiminiz var mı? Varsa anlatın.',
            required: false,
            style: TextInputStyle.Paragraph
        }, {
            id: 'aktiflik',
            label: 'Sunucuda ne kadar aktif olabilirsiniz?',
            required: true,
            style: TextInputStyle.Short
        }, {
            id: 'owo-bilgi',
            label: 'OwO bot bilginiz nasıl?',
            required: true,
            style: TextInputStyle.Short
        }, {
            id: 'takim-meta',
            label: 'Takım metası bilginiz nedir?',
            required: true,
            style: TextInputStyle.Paragraph
        }]
    };

    questions[customId].forEach(q => {
        const input = new TextInputBuilder()
            .setCustomId(q.id)
            .setLabel(q.label)
            .setStyle(q.style)
            .setRequired(q.required);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    try {
        await interaction.showModal(modal);
    } catch (e) {
        console.error('[HATA] Başvuru modalı gösterilirken hata:', e);
        await interaction.reply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
        });
    }
}

/**
 * Başvuru modalı gönderildiğinde işler. Embed oluşturup başvuruyu yetkili kanalına gönderir
 * ve reaksiyon kolektörü başlatır.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processBasvuruModal(interaction) {
    await interaction.deferReply({
        ephemeral: true
    });
    const {
        user,
        guild,
        client,
        customId
    } = interaction;

    const config = {
        'yetkili-basvuru-modal': {
            type: 'Yetkili',
            channelId: '1268544826727600168',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'],
            questions: [{
                id: 'isim-yas',
                label: 'İsim ve yaşınız'
            }, {
                id: 'neden-basvuru',
                label: 'Neden bu pozisyona başvuruyorsunuz?'
            }, {
                id: 'deneyim',
                label: 'Deneyim'
            }, {
                id: 'aktiflik',
                label: 'Ne kadar aktifsiniz?'
            }, {
                id: 'neden-secilmeli',
                label: 'Neden sizi seçmeliyiz?'
            }]
        },
        'helper-basvuru-modal': {
            type: 'Helper',
            channelId: '1268544982768160788',
            requiredRoles: ['1243478734078742579', '1216094391060529393', '1188389290292551740'],
            questions: [{
                id: 'isim-yas',
                label: 'İsim ve yaşınız'
            }, {
                id: 'helper-deneyim',
                label: 'Helper deneyiminiz'
            }, {
                id: 'aktiflik',
                label: 'Ne kadar aktifsiniz?'
            }, {
                id: 'owo-bilgi',
                label: 'OwO bot bilginiz'
            }, {
                id: 'takim-meta',
                label: 'Takım metası bilginiz'
            }]
        }
    };

    const basvuruConfig = config[customId];
    if (!basvuruConfig) return;

    // Başvuru sonuçlarını içeren embed oluştur
    const basvuruEmbed = new EmbedBuilder()
        .setTitle(`${basvuruConfig.type} Başvurusu`)
        .setAuthor({
            name: user.tag,
            iconURL: user.displayAvatarURL()
        })
        .setDescription(`**Başvuru Yapan:** ${user}`)
        .addFields(basvuruConfig.questions.map(q => ({
            name: `❓ ${q.label}`,
            value: interaction.fields.getTextInputValue(q.id) || 'Cevap verilmedi',
            inline: false,
        })))
        .setColor('#0099ff')
        .setFooter({
            text: `${guild.name} | ${basvuruConfig.type} Başvurusu`,
            iconURL: guild.iconURL()
        })
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    const resultChannel = client.channels.cache.get(basvuruConfig.channelId);
    if (!resultChannel) {
        console.error(`[KRİTİK HATA] Sonuç kanalı bulunamadı: ${basvuruConfig.channelId}`);
        return interaction.editReply({
            content: 'Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.'
        });
    }

    // Yetkili rolünü etiketle
    const yetkiliRoleId = '1243478734078742579';

    const sentMessage = await resultChannel.send({
        content: `<@&${yetkiliRoleId}> Yeni bir ${basvuruConfig.type} başvurusu var.`,
        embeds: [basvuruEmbed]
    });

    const EMOJI_ONAY_ID = '1284130169417764907';
    const EMOJI_RED_ID = '1284130046902145095';

    await sentMessage.react(EMOJI_ONAY_ID);
    await sentMessage.react(EMOJI_RED_ID);

    // Reaksiyon toplayıcı
    const collector = sentMessage.createReactionCollector({
        filter: (reaction, reactor) => {
            const member = interaction.guild.members.cache.get(reactor.id);
            const isAuthorized = member && basvuruConfig.requiredRoles.some(roleId => member.roles.cache.has(roleId));
            return (reaction.emoji.id === EMOJI_ONAY_ID || reaction.emoji.id === EMOJI_RED_ID) && isAuthorized;
        },
        max: 1,
        time: 3600000 // 1 saat
    });

    collector.on('collect', async (reaction, reactor) => {
        const isApproved = reaction.emoji.id === EMOJI_ONAY_ID;
        const statusText = isApproved ? 'ONAYLANDI' : 'REDDEDİLDİ';

        const finalEmbed = new EmbedBuilder()
            .setTitle(`MED Başvuru`)
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL()
            })
            .setDescription(`**Başvurunuz sonuçlandı!**`)
            .addFields({
                name: `Başvuru Durumu`,
                value: `${basvuruConfig.type} başvurunuz, <@${reactor.id}> kişisi tarafından **${statusText}**`,
                inline: false
            })
            .setColor(isApproved ? '#2ecc71' : '#e74c3c')
            .setFooter({
                text: `${guild.name} | ${basvuruConfig.type} Başvurusu`,
                iconURL: guild.iconURL()
            })
            .setTimestamp();

        const finalResultChannel = client.channels.cache.get('1277638999464214558');
        if (finalResultChannel) {
            try {
                // Hata kontrolü için try-catch bloğu eklendi
                await finalResultChannel.send({
                    embeds: [finalEmbed]
                });
            } catch (error) {
                console.error('[KRİTİK HATA] Başvuru sonuç mesajı gönderilirken bir hata oluştu:', error);
            }
        }

        // Reaksiyonları kaldır
        await sentMessage.reactions.removeAll().catch(error => console.error('Emojiler kaldırılamadı:', error));
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            sentMessage.reactions.removeAll().catch(error => console.error('Emojiler kaldırılamadı:', error));
        }
    });

    await interaction.editReply({
        content: `Başvurunuz başarıyla alındı. Yetkililer en kısa sürede değerlendirecektir.`
    });
}

/**
 * Üst yetkiliyle görüşme butonu tıklandığında modalı gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleGorusmeButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('gorusme-modal')
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
        console.error('[HATA] Görüşme modalı gösterilirken hata:', e);
        await interaction.reply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
        });
    }
}

/**
 * Görüşme modalı gönderildiğinde işler. Yeni bir kanal oluşturur ve embedi gönderir.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processGorusmeModal(interaction) {
    await interaction.deferReply({
        ephemeral: true
    });
    const {
        user,
        guild
    } = interaction;
    const konu = interaction.fields.getTextInputValue('konu-input');
    const detay = interaction.fields.getTextInputValue('detay-input');

    const CATEGORY_ID = '1268509251911811175';
    const GORUSME_YETKILISI_ROLE_ID = '1236317902295138304';

    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `gorusme-${cleanUsername}`;

    const existingChannel = guild.channels.cache.find(
        c => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({
            content: `Zaten aktif bir görüşme kanalınız var: <#${existingChannel.id}>`
        });
    }

    try {
        const newChannel = await guild.channels.create({
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
                id: GORUSME_YETKILISI_ROLE_ID,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }],
        });

        const gorusmeEmbed = new EmbedBuilder()
            .setTitle('Üst Yetkiliyle Görüşme Talebi')
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL()
            })
            .setDescription(`**Görüşme Talep Eden:** ${user}\n**Konu:** ${konu}\n**Detay:**\n${detay}`)
            .setColor('#e74c3c')
            .setTimestamp();

        // Kanalı kapatma butonu
        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId('close-gorusme-channel')
            .setLabel('Görüşmeyi Kapat')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

        await newChannel.send({
            content: `<@&${GORUSME_YETKILISI_ROLE_ID}> Yeni bir görüşme talebi var.`,
            embeds: [gorusmeEmbed],
            components: [closeButton]
        });

        await interaction.editReply({
            content: `Üst yetkiliyle görüşme kanalınız oluşturuldu: ${newChannel}. Lütfen yetkililerin yanıtını bekleyin.`
        });

    } catch (error) {
        console.error('[KRİTİK HATA] Görüşme kanalı oluşturulurken veya işlenirken hata:', error);
        await interaction.editReply({
            content: 'Görüşme kanalı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
        });
    }
}

/**
 * Görüşme kanalını kapatma butonunu işler.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleCloseChannelButton(interaction) {
    // deferUpdate ile anında yanıt ver.
    await interaction.deferUpdate();

    const {
        channel,
        member
    } = interaction;
    const GORUSME_YETKILISI_ROLE_ID = '1236317902295138304';
    const GORUSME_KATEGORI_ID = '1268509251911811175';

    // Sadece görüşme kanallarında çalışır
    if (channel.parentId !== GORUSME_KATEGORI_ID) {
        return;
    }

    // Yetkili rolüne sahip olanlar veya kanalı açan kişi kanalı kapatabilir.
    const hasPermission = member.roles.cache.has(GORUSME_YETKILISI_ROLE_ID);

    if (!hasPermission) {
        // Yetkisi olmayan kişiye ephemeral bir mesaj gönder
        return interaction.followUp({
            content: 'Bu kanalı kapatma yetkiniz bulunmamaktadır.',
            ephemeral: true
        });
    }

    try {
        await channel.delete();
    } catch (error) {
        console.error('[HATA] Kanal silinirken bir hata oluştu:', error);
        await interaction.followUp({
            content: 'Kanal silinirken bir hata oluştu. Lütfen manuel olarak silmeyi deneyin.',
            ephemeral: true
        });
    }
}
