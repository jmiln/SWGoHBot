exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;


    const gearGrab = await snekfetch.get(gearLink);
    const gearGrabText = gearGrab.text;

    $ = cheerio.load(gearGrabText);

    // Get the gear
    $('.media.list-group-item.p-0.character').each(function(i) {
        const thisGear = $(this).find('a').attr('title');
        const gearLvl = 'Gear ' + (Math.floor(i / 6) + 1).toString();
        if (character.gear[gearLvl]) {
            character.gear[gearLvl].push(thisGear);
        } else {
            character.gear[gearLvl] = [thisGear];
        }
    });
    return character;
}