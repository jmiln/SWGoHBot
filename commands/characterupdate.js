exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;

    const searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    if (searchName === "") {
        return message.channel.send(`Need a character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }
    const char = client.findCharByName(searchName, charList);
    console.log(char);
    if (!char || chars.length <= 0) {
        return message.channel.send(`Invalid character. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    //     const gearGrab = await snekfetch.get(char.url + "gear");
    //     const gearGrabText = gearGrab.text;

    //     $ = cheerio.load(gearGrabText);

    //     // Get the gear
    //     $('.media.list-group-item.p-0.character').each(function(i) {
    //         const thisGear = $(this).find('a').attr('title');
    //         const gearLvl = 'Gear ' + (Math.floor(i / 6) + 1).toString();
    //         if (char.gear[gearLvl]) {
    //             char.gear[gearLvl].push(thisGear);
    //         } else {
    //             char.gear[gearLvl] = [thisGear];
    //         }
    //     });

    // }

    // //Update json after scrape
    //     if (updated || newChar) {
    //         updated = false, newChar = false;
    //         fs.writeFile("./data/characters.json", JSON.stringify(currentCharacters, null, 4), 'utf8', function(err) {
    //             if (err) {
    //                 return console.log(err);
    //             }
    //             client.characters = currentCharacters;
    //         });
};

exports.conf = {
    enabled: true,
    guildOnly: true,
    aliases: ['update', 'u'],
    permLevel: 3
};

exports.help = {
    name: 'update',
    category: 'Dev',
    description: 'Updates the gear/mods requirements for the specified character.',
    usage: 'update <character> [gear/mods]',
    example: `;update rex gear`,
    extended: `\`\`\`asciidoc
character   :: The character you want to look up the gear for.
gear/mods    :: Specify the item in which you update.
    \`\`\``
};
