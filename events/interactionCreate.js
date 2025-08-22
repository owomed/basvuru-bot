// Bu dosya `./events/` klasörüne taşınmalıdır.
// Bu dosya hem başvuru, hem soru talep, hem de şikayet (ticket) butonlarını işler.
// Discord.js v14 ile uyumludur.

const {
    MessageActionRow,
    Modal,
    TextInputComponent,
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
    const { customId } = interaction;
    const basvuruTuru = customId.includes('yetkili') ? 'Yetkili' : 'Helper';
    const modalCustomId = customId.replace('Başvuru', '-basvuru-modal');

    const modal = new Modal()
        .setCustomId(modalCustomId)
        .setTitle(`${basvuruTuru} Başvuru Formu`);

    const questions = {
        yetkiliBaşvuru: [
            { id: 'isim-yas-input', label: 'İsim ve yaşınız nedir?', required: true, style: 1 },
            { id: 'neden-basvuru-input', label: 'Neden bu pozisyona başvuruyorsunuz?', required: true, style: 2 },
            { id: 'deneyim-input', label: 'Bir deneyiminiz var mı? Varsa anlatın.', required: false, style: 2 },
            { id: 'aktiflik-input', label: 'Sunucuda ne kadar aktif olabilirsiniz?', required: true, style: 1 },
            { id: 'neden-secilmeli-input', label: 'Neden sizi seçmeliyiz?', required: true, style: 2 }
        ],
        helperBaşvuru: [
            { id: 'isim-yas-input', label: 'İsim ve yaşınız nedir?', required: true, style: 1 },
            { id: 'helper-deneyim-input', label: 'Helper deneyiminiz var mı? Varsa anlatın.', required: false, style: 2 },
            { id: 'aktiflik-input', label: 'Sunucuda ne kadar aktif olabilirsiniz?', required: true, style: 1 },
            { id: 'owo-bilgi-input', label: 'OwO bot bilginiz nasıl?', required: true, style: 1 },
            { id: 'takim-meta-input', label: 'Takım metası bilginiz nedir?', required: true, style: 2 }
        ]
    };

    const textInputs = questions[customId].map(q =>
        new TextInputComponent()
        .setCustomId(q.id)
        .setLabel(q.label)
        .setStyle(q.style) // 1 = SHORT, 2 = PARAGRAPH
        .setRequired(q.required)
    );

    // Tüm text inputları action row'lara ekle
    textInputs.forEach(input => modal.addComponents(new MessageActionRow().addComponents(input)));

    // Modal'ı kullanıcıya göster
    try {
        await interaction.showModal(modal);
        console.log(`[DEBUG] Başvuru modalı kullanıcıya gösterildi: ${modal.customId}`);
    } catch (e) {
        console.error('[HATA] Başvuru modalı gösterilirken hata oluştu:', e);
        await interaction.reply({
            content: 'Form açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
        });
    }
}

/**
 * Başvuru modalı doldurulup gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processBasvuruModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
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

    // Kullanıcı adını küçük harfe çevir ve Discord kanal adı kurallarına uygun hale getir.
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const channelName = `${config.namePrefix}${cleanUsername}`;

    // Mevcut başvuru kanalını kontrol et
    const existingChannel = guild.channels.cache.find(
        (c) => c.name === channelName && c.parentId === CATEGORY_ID
    );

    if (existingChannel) {
        return interaction.editReply({
            content: `Zaten aktif bir başvuru kanalınız var: <#${existingChannel.id}>`
        });
    }

    let newChannel;
    try {
        // Yeni başvuru kanalı oluştur
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
            await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
            return;
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

        // Kullanıcıya kanala gidileceğini bildir
        await interaction.editReply({
            content: `Başvurunuz başarıyla alındı ve kanalınız oluşturuldu: ${newChannel}. Lütfen yetkililerin yanıtını bekleyin.`
        });
        
        // Kanalı silme mesajı
        await newChannel.send('Bu başvuru kanalı 10 dakika sonra otomatik olarak silinecektir.');

        // 10 dakika sonra kanalı silme işlemi
        setTimeout(() => newChannel.delete().catch(() => {}), 600000); // 10 dakika = 600000 ms

    } catch (error) {
        console.error('[KRİTİK HATA] Başvuru işlenirken genel bir hata oluştu:', error);
        if (newChannel) {
            newChannel.delete().catch(err => console.error('[HATA] Hata oluştuğunda kanal silinemedi:', err));
        }
        await interaction.editReply({
            content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        });
    }
}

/**
 * Soru talep butonu tıklandığında modalı (formu) gösterir.
 * @param {import('discord.js').ButtonInteraction} interaction - Gelen buton etkileşimi.
 */
async function handleSoruTalep(interaction) {
    const modal = new Modal()
        .setCustomId('soru-talep-modal')
        .setTitle('Soru Talep Formu');

    const questionInput = new TextInputComponent()
        .setCustomId('soru-input')
        .setLabel('Sorunuzu buraya yazın')
        .setStyle(TextInputComponent.Styles.PARAGRAPH)
        .setRequired(true);

    modal.addComponents(new MessageActionRow().addComponents(questionInput));

    await interaction.showModal(modal);
}

/**
 * Soru talep modalı doldurulup gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processSoruTalepModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
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
    const modal = new Modal()
        .setCustomId('gorus-modal')
        .setTitle('Üst Yetkiliyle Görüşme Talebi');

    const konuInput = new TextInputComponent()
        .setCustomId('konu-input')
        .setLabel('Görüşme konunuz nedir?')
        .setStyle(TextInputComponent.Styles.SHORT)
        .setRequired(true);

    const detayInput = new TextInputComponent()
        .setCustomId('detay-input')
        .setLabel('Detaylı açıklamanız.')
        .setStyle(TextInputComponent.Styles.PARAGRAPH)
        .setRequired(true);

    modal.addComponents(
        new MessageActionRow().addComponents(konuInput),
        new MessageActionRow().addComponents(detayInput)
    );

    await interaction.showModal(modal);
}

/**
 * Görüşme modalı doldurulup gönderildiğinde işler.
 * @param {import('discord.js').ModalSubmitInteraction} interaction - Gelen modal etkileşimi.
 */
async function processGorusModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { user, guild } = interaction;
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
