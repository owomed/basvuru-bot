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
        // ZAMAN AŞIMI HATASI GİDERİLDİ:
        // Eğer etkileşim zaten ertelenmiş veya yanıtlanmışsa,
        // tekrar işlem yapmaya çalışarak hata vermeyi önler.
        if (interaction.deferred || interaction.replied) {
            return;
        }

        // Sadece buton ve modal etkileşimlerini işleme al, diğerlerini yok say.
        if (!interaction.isButton() && !interaction.isModalSubmit()) {
            return;
        }

        // --- BUTON ETKİLEŞİMLERİ İŞLEME KISMI ---
        if (interaction.isButton()) {
            // Dinamik ID'ye sahip olan onay/reddet butonları için kontrol
            if (interaction.customId.startsWith('onayla-basvuru') || interaction.customId.startsWith('reddet-basvuru')) {
                await handleResultButtons(interaction);
                return;
            }

            // Statik ID'ye sahip diğer butonlar için switch
            switch (interaction.customId) {
                // Başvuru butonları tıklandığında (ilk adım)
                case 'yetkiliBaşvuru':
                case 'helperBaşvuru':
                    await handleBasvuruFirstStep(interaction);
                    break;
                // Form açma butonları tıklandığında (ikinci adım)
                case 'open-yetkili-modal':
                case 'open-helper-modal':
                    await handleBasvuruSecondStep(interaction);
                    break;
                case 'görüş':
                    await handleGorusmeButton(interaction);
                    break;
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
                case 'yetkili-basvuru-modal':
                case 'helper-basvuru-modal':
                    await processBasvuruModal(interaction);
                    break;
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
 * Başvuru butonları tıklandığında (ilk aşama), üyeye form açma butonu gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleBasvuruFirstStep(interaction) {
    // UYARI GİDERİLDİ: "ephemeral" yerine "flags" kullanıldı.
    await interaction.deferReply({
        flags: 64
    });

    const basvuruTuru = interaction.customId.includes('yetkili') ? 'Yetkili' : 'Helper';
    const buttonCustomId = interaction.customId.includes('yetkili') ? 'open-yetkili-modal' : 'open-helper-modal';

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(buttonCustomId)
            .setLabel(`Formu Doldur: ${basvuruTuru}`)
            .setStyle(ButtonStyle.Primary)
        );

    await interaction.editReply({
        content: 'Lütfen başvurunuza devam etmek için aşağıdaki butona tıklayın.',
        components: [actionRow]
    });
}

/**
 * Üyenin gönderdiği formu açma butonunu işler (ikinci aşama) ve modalı gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleBasvuruSecondStep(interaction) {
    const {
        customId
    } = interaction;
    const basvuruTuru = customId.includes('yetkili') ? 'Yetkili' : 'Helper';
    const modalCustomId = customId.includes('yetkili') ? 'yetkili-basvuru-modal' : 'helper-basvuru-modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(`${basvuruTuru} Başvuru Formu`);

    const questions = {
        'open-yetkili-modal': [{
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
        'open-helper-modal': [{
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
        // Hata durumunda, kullanıcının gördüğü mesajı güncelleyelim.
        await interaction.editReply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            components: []
        });
    }
}

/**
 * Başvuru modalı gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processBasvuruModal(interaction) {
    // UYARI GİDERİLDİ: "ephemeral" yerine "flags" kullanıldı.
    await interaction.deferReply({
        flags: 64
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

    const yetkiliRoleId = '1243478734078742579';

    const resultChannel = client.channels.cache.get(basvuruConfig.channelId);
    if (!resultChannel) {
        console.error(`[KRİTİK HATA] Sonuç kanalı bulunamadı: ${basvuruConfig.channelId}`);
        return interaction.editReply({
            content: 'Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.'
        });
    }

    // Onay ve Ret butonları oluşturuluyor
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`onayla-basvuru-${user.id}`)
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
            .setCustomId(`reddet-basvuru-${user.id}`)
            .setLabel('Reddet')
            .setStyle(ButtonStyle.Danger),
        );

    try {
        await resultChannel.send({
            content: `<@&${yetkiliRoleId}> Yeni bir ${basvuruConfig.type} başvurusu var.`,
            embeds: [basvuruEmbed],
            components: [actionRow]
        });
    } catch (e) {
        console.error('[HATA] Başvuru mesajı gönderilirken hata:', e);
        return interaction.editReply({
            content: 'Hata: Başvuru mesajı yetkili kanalına gönderilemedi.'
        });
    }

    await interaction.editReply({
        content: `Başvurunuz başarıyla alındı. Yetkililer en kısa sürede değerlendirecektir.`
    });
}

/**
 * Onay ve Reddet butonlarını işler.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleResultButtons(interaction) {
    // UYARI GİDERİLDİ: "ephemeral" yerine "flags" kullanıldı.
    await interaction.deferReply({
        flags: 64
    });

    const {
        customId,
        user,
        guild,
        client
    } = interaction;

    // Yetki kontrolü (sadece yetkili rollerine sahip olanlar butona basabilir)
    const requiredRoles = ['1243478734078742579', '1216094391060529393', '1188389290292551740'];
    const member = guild.members.cache.get(user.id);
    const hasPermission = member && requiredRoles.some(roleId => member.roles.cache.has(roleId));

    if (!hasPermission) {
        return interaction.editReply({
            content: 'Bu butonu kullanma yetkiniz yok.',
            flags: 64
        });
    }

    // Orijinal başvuru mesajındaki embed'i al
    const originalEmbed = interaction.message.embeds[0];
    const footerText = originalEmbed?.footer?.text;
    const basvuruType = footerText ? footerText.split('|')[1]?.trim()?.split(' ')[0] : 'Bilinmeyen';

    // Buton ID'sinden başvuran kullanıcının ID'sini çek
    const applicantId = customId.split('-').pop(); // .split('-')[2] yerine .pop() daha güvenilir
    const isApproved = customId.startsWith('onayla');
    const statusText = isApproved ? 'onaylandı <:med_onaylandi:1284130169417764907>' : 'reddedildi <:med_onaylandi:1284130169417764907>';

    // Yeni: Başvurunun türünü embed'e ekle
    const finalEmbed = new EmbedBuilder()
        .setTitle(`Başvurunuz sonuçlandı!`)
        .setAuthor({
            name: 'MED Başvuru'
        })
        .setDescription(`\`Başvuru yapan:\`\n<@${applicantId}>`)
        .addFields({
            name: `${basvuruType} Başvurusu Durumu`,
            value: `Başvurunuz, <@${interaction.user.id}> kişisi tarafından **${statusText}**`,
            inline: false
        })
        .setColor(isApproved ? '#2ecc71' : '#e74c3c')
        .setFooter({
            text: `${guild.name}🤍|${basvuruType} başvuru sonucu`,
            iconURL: guild.iconURL()
        })
        .setTimestamp();

    // Mesajın orijinal sahibini bul (başvuran kişi) ve ona özel mesaj gönder
    const applicantUser = await client.users.fetch(applicantId).catch(() => null);
    if (applicantUser) {
        try {
            await applicantUser.send({
                embeds: [finalEmbed]
            });
        } catch (e) {
            console.error('[HATA] Başvuran kişiye özel mesaj gönderilemedi:', e);
        }
    }

    // Başvuru sonuç kanalına mesaj gönder (her iki yöntem de denenecek)
    let finalResultChannel = client.channels.cache.get('1277638999464214558');
    
    if (!finalResultChannel) {
        console.log('[HATA AYIKLAMA] Sonuç kanalı önbellekte bulunamadı. Discord\'dan çekiliyor...');
        try {
            finalResultChannel = await client.channels.fetch('1277638999464214558');
        } catch (error) {
            console.error('[KRİTİK HATA] Başvuru sonuç kanalı Discord\'dan çekilirken hata:', error);
            return interaction.editReply({ content: 'Sonuç kanalı bulunamadı. Lütfen bot sahibine bildirin.' });
        }
    }
    
    if (finalResultChannel) {
        try {
            await finalResultChannel.send({ embeds: [finalEmbed] });
        } catch (error) {
            console.error('[KRİTİK HATA] Başvuru sonuç mesajı gönderilirken bir hata oluştu:', error);
            return interaction.editReply({ content: 'Sonuç mesajı gönderilemedi. Lütfen botun kanal yetkilerini kontrol edin.' });
        }
    } else {
        console.error('[KRİTİK HATA] Sonuç kanalı hala bulunamıyor. Lütfen kanal ID\'sini ve bot yetkilerini kontrol edin.');
        return interaction.editReply({ content: 'Sonuç kanalı bulunamadı. Lütfen bot sahibine bildirin.' });
    }

    // Başvuru mesajının butonlarını devre dışı bırak
    const originalMessage = interaction.message;
    if (originalMessage) {
        const disabledActionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                .setCustomId('onaylandi')
                .setLabel('Onaylandı')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
                new ButtonBuilder()
                .setCustomId('reddedildi')
                .setLabel('Reddedildi')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            );
        
        // Orijinal mesajı düzenle ve butonları kaldır
        await originalMessage.edit({
            components: [disabledActionRow]
        }).catch(e => console.error('[HATA] Orijinal mesaj güncellenemedi:', e));
    }
    
    await interaction.editReply({
        content: `Başvuru başarıyla **${statusText}** olarak işaretlendi. Sonuç kanala gönderildi.`
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
            flags: 64
        });
    }
}

/**
 * Görüşme modalı gönderildiğinde işler. Yeni bir kanal oluşturur ve embedi gönderir.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processGorusmeModal(interaction) {
    // UYARI GİDERİLDİ: "ephemeral" yerine "flags" kullanıldı.
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
            flags: 64
        });
    }

    try {
        await channel.delete();
    } catch (error) {
        console.error('[HATA] Kanal silinirken bir hata oluştu:', error);
        await interaction.followUp({
            content: 'Kanal silinirken bir hata oluştu. Lütfen manuel olarak silmeyi deneyin.',
            flags: 64
        });
    }
}
