exports.run = (client, message, args) => {
    let character = String(args.join(' ')).toLowerCase().replace(/[^\w]/gi, '');

    switch (character) {
        case 'a':
        case 'aayla':
        case 'aaylasecura':
            message.channel.send(" * Aayla Secura * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'ackbar':
        case 'admiralackbar':
            message.channel.send(" * Admiral Ackbar * \n### Sets ### \n* Speed \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'ahsoka':
        case 'ahsokatano':
                code: 'md'
            message.channel.send(" * Ahsoka Tano * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
            });
            break;
        case 'asajj':
        case 'ventress':
        case 'asajjventress':
            message.channel.send(" * Asajj Ventress * \n### Sets ### \n* Critical Damage \n* Critical Chance      \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'b2':
            message.channel.send(" * B2 (with HK-47 lead) * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Accuracy \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            message.channel.send(" * B2 (without HK-47) * \n### Sets ### \n* Offense \n* Potency   \n### Primaries ### \n* Square:   Offense \n* Arrow:    Accuracy \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'barris':
        case 'zarris':
            message.channel.send(" * Bariss Offee * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Health \n* Circle:   Health \n* Cross:    Health", {
                code: 'md'
            });
            break;
        case 'baze':
        case 'bazemalbus':
            message.channel.send(" * Baze Malbus * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'biggs':
        case 'biggsdarklighter':
            message.channel.send(" * Biggs Darklighter * \n### Sets ### \n* Critical Damage \n* Critical Chance   \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'bistan':
            message.channel.send(" * Bistan * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'boba':
        case 'fett':
        case 'bobafett':
            message.channel.send(" * Boba Fett (attacker) * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Boba Fett (leader) * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Boba Fett (support) * \n### Sets ### \n* Potency \n* Potency \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'bodhi':
        case 'bodhirook':
            message.channel.send(" * Bohdi Rook * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection/ Potency", {
                code: 'md'
            });
            break;
        case 'cody':
        case 'cc2224':
        case '2224':
        case 'cc2224cody':
            message.channel.send(" * CC-2224 Cody (attacker) * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * CC-2224 Cody (leader) * \n### Sets ### \n* Critical Damage \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'echo':
        case 'ct210408':
        case 'ct210408echo':
            message.channel.send(" * CT-21-0408 Echo * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense", {
                code: 'md'
            });
            break;
        case 'fives':
        case '5s':
        case 'ct5555':
        case 'ct5555fives':
            message.channel.send(" * CT-5555 Fives * \n### Sets ### \n* Defense \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'rex':
        case 'ct7567':
        case 'ct7567rex':
            message.channel.send(" * CT-7567 Rex (leader) * \n### Sets ### \n* Tenacity \n* Tenacity \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            message.channel.send(" * CT-7567 Rex (support) * \n### Sets ### \n* Speed \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'cad':
        case 'bane':
        case 'cadbane':
            message.channel.send(" * Cad Bane * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'phasma':
        case 'captainphasma':
            message.channel.send(" * Captain Phasma * \n### Sets ### \n* Speed \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'cassian':
        case 'andor':
        case 'cassianandor':
            message.channel.send(" * Cassian Andor * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'chirpa':
        case 'chiefchirpa':
            message.channel.send(" * Chief Chirpa * \n### Sets ### \n* Speed \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'nebit':
        case 'chiefnebit':
            message.channel.send(" * Chief Nebit * \n### Sets ### \n* Health \n* Health \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'chirrut':
        case 'chirrutimwe':
            message.channel.send(" * Chirrut Imwe * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'chopper':
            message.channel.send(" * Chopper * \n### Sets ### \n* Speed \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed / Protection / Prot. \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'cs1':
        case 'clone sergeant p1':
            message.channel.send(" * Clone Sergeant P1 * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'chewie':
        case 'chewbacca':
        case 'clonewarschewbacca':
            message.channel.send(" * Clone Wars Chewbacca * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'dooku':
        case 'countdooku':
            message.channel.send(" * Count Dooku * \n### Sets ### \n* Offense \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'maul':
        case 'zaul':
        case 'darthmaul':
            message.channel.send(" * Darth Maul * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'nihilus':
        case 'darthnihilus':
            message.channel.send(" * Darth Nihilus * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            message.channel.send(" * Darth Nihilus (leader) * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'sid':
        case 'sideous':
        case 'darthsideous':
            message.channel.send(" * Darth Sidious * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'vader':
        case 'darthvader':
            message.channel.send(" * Darth Vader * \n### Sets ### \n* Potency \n* Potency \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            message.channel.send(" * Darth Vader (EP lead) * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'datcha':
            message.channel.send(" * Datcha * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'dt':
        case 'deathtrooper':
            message.channel.send(" * Death Trooper (Krennic lead) * \n### Sets ### \n* Critical Chance \n* Critical Damage \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Death Trooper (Palp lead) * \n### Sets ### \n* Critical Chance \n* Critical Damage \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Death Trooper (Vader lead) * \n### Sets ### \n* Critical Damage \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'dengar':
            message.channel.send(" * Dengar * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'krennic':
        case 'directorkrennic':
            message.channel.send(" * Director Krennic (Palp lead) * \n### Sets ### \n* Critical Chance \n* Critical Damage \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Director Krennic (Vader lead) * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            message.channel.send(" * Director Krennic (leader) * \n### Sets ### \n* Critical Chance \n* Critical Damage \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'eeth':
        case 'eethkoth':
            message.channel.send(" * Eeth Koth * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'ep':
        case 'palpatine':
        case 'empororpalpatine':
            message.channel.send(" * Emperor Palpatine * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            message.channel.send(" * Emperor Palpatine (leader) * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'ee':
        case 'elder':
        case 'ewokelder':
            message.channel.send(" * Ewok Elder * \n### Sets ### \n* Speed \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'ewokscout':
            message.channel.send(" * Ewok Scout * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'ezra':
        case 'bridger':
        case 'ezrabridger':
            message.channel.send(" * Ezra Bridger * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'finn':
            message.channel.send(" * Finn * \n### Sets ### \n* Speed \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'foo':
        case 'firstorderofficer':
            message.channel.send(" * First Order Officer * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'fos':
        case 'firstorderstormtrooper':
            message.channel.send(" * First Order Stormtrooper * \n### Sets ### \n* Potency \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'fotp':
        case 'firstordertiepilot':
            message.channel.send(" * First Order TIE Pilot * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'gamorreanguard':
            message.channel.send(" * Gamorrean Guard * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Tenacity", {
                code: 'md'
            });
            break;
        case 'gar':
        case 'saxon':
        case 'garsaxon':
            message.channel.send(" * Gar Saxon * \n### Sets ### \n* Potency \n* Potency \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'zeb':
        case 'garazeb':
        case 'garazebzeborrelios':
            message.channel.send(" * Garazeb 'Zeb' Orrelios * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'gg':
        case 'grievous':
        case 'generalgrievous':
            message.channel.send(" * General Grievous * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            message.channel.send(" * General Grievous (HK-47 lead) * \n### Sets ### \n* Critical Damage \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'gk':
        case 'kenobi':
            message.channel.send(" * General Kenobi * \n### Sets ### \n* Tenacity \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Tenacity", {
                code: 'md'
            });
            break;
        case 'veers':
        case 'generalveers':
            message.channel.send(" * General Veers * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            message.channel.send(" * General Veers (Leader) * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Offense", {
                code: 'md'
            });
            break;
        case 'gs':
        case 'geonosiansoldier':
            message.channel.send(" * Geonosian Soldier * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'geonosianspy':
            message.channel.send(" * Geonosian Spy * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'yoda':
        case 'masteryoda':
        case 'grandmasteryoda':
            message.channel.send(" * Grand Master Yoda * \n### Sets ### \n* Speed \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'tarkin':
        case 'grandmofftarkin':
            message.channel.send(" * Grand Moff Tarkin * \n### Sets ### \n* Speed \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'greedo':
            message.channel.send(" * Greedo * \n### Sets ### \n* Potency \n* Critical Chance \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'hk':
        case 'hk47':
            message.channel.send(" * HK-47 * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'han':
        case 'hansolo':
            message.channel.send(" * Han Solo * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'hera':
        case 'herasyndulla':
            message.channel.send(" * Hera Syndulla * \n### Sets ### \n* Health \n* Health \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'hothrebelscout':
            message.channel.send(" * Hoth Rebel Scout * \n### Sets ### \n* Offense \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'hothrebelsoldier':
            message.channel.send(" * Hoth Rebel Soldier * \n### Sets ### \n* Health \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'magna':
        case 'magnaguard':
        case 'ig100magnaguard':
            message.channel.send(" * IG-100 Magna Guard * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'ig86':
        case 'ig86sentineldroid':
            message.channel.send(" * IG-86 Sentinel Droid * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense", {
                code: 'md'
            });
            break;
        case 'ig88':
            message.channel.send(" * IG-88 * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense", {
                code: 'md'
            });
            break;
        case 'igd':
        case 'ima':
        case 'imagundi':
            message.channel.send(" * Ima-Gun Di * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'isc':
        case 'imperialsupercommander':
            message.channel.send(" * Imperial Super Commando * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'jawa':
            message.channel.send(" * Jawa * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'engineer':
        case 'jawaengineer':
            message.channel.send(" * Jawa Engineer * \n### Sets ### \n* Speed \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'scavenger':
        case 'jawascavenger':
            message.channel.send(" * Jawa Scavenger * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'jc':
        case 'jediconsular':
            message.channel.send(" * Jedi Consular * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'jka':
        case 'anakin':
        case 'jediknightanakin':
            message.channel.send(" * Jedi Knight Anakin * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'jkg':
        case 'jediknightguardian':
            message.channel.send(" * Jedi Knight Guardian * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'jyn':
        case 'jynerso':
            message.channel.send(" * Jyn Erso * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'k2s0':
        case 'k2so':
            message.channel.send(" * K-2SO * \n### Sets ### \n* Tenacity \n* Tenacity \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'kannan':
        case 'kannanjarus':
            message.channel.send(" * Kanan Jarrus * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance / Protection \n* Circle:   Protection \n* Cross:    Protection / Tenacity", {
                code: 'md'
            });
            break;
        case 'kit':
        case 'fisto':
        case 'kitfisto':
            message.channel.send(" * Kit Fisto * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'kylo':
        case 'ren':
        case 'kyloren':
            message.channel.send(" * Kylo Ren * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'lando':
        case 'landocalrissian':
            message.channel.send(" * Lando Calrissian * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'lobot':
            message.channel.send(" * Lobot * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'lukeskywalker':
            message.channel.send(" * Luke Skywalker * \n### Sets ### \n* Critical Chance \n* Critical Chance \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'luminara':
        case 'luminaraunduli':
            message.channel.send(" * Luminara Unduli * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Health / Protection / Prot. \n* Circle:   Health / Protection / Prot. \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'mace':
        case 'macewindu':
            message.channel.send(" * Mace Windu * \n### Sets ### \n* Health \n* Health \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'mt':
        case 'magmatrooper':
            message.channel.send(" * Magmatrooper * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'nightsisteracolyte':
            message.channel.send(" * Nightsister Acolyte * \n### Sets ### \n* Critical Chance \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'nightsisterinitiate':
            message.channel.send(" * Nightsister Initiate * \n### Sets ### \n* Health \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'nute':
        case 'nutegunray':
            message.channel.send(" * Nute Gunray * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'ben':
        case 'oldben':
        case 'obiwan':
        case 'obiwankenobi':
            message.channel.send(" * Obi-Wan Kenobi (Old Ben) * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'daka':
        case 'olddaka':
            message.channel.send(" * Old Daka * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'pao':
            message.channel.send(" * Pao * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'plo':
        case 'plokoon':
            message.channel.send(" * Plo Koon * \n### Sets ### \n* Potency \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'poe':
        case 'poe dameron':
            message.channel.send(" * Poe Dameron * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'poggle':
        case 'pogglethelesser':
            message.channel.send(" * Poggle The Lesser * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'leia':
        case 'princessleia':
            message.channel.send(" * Princess Leia * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'qgj':
        case 'quigon':
        case 'quigonjin':
            message.channel.send(" * Qui-Gon Jinn * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'r2':
        case 'r2d2':
            message.channel.send(" * R2-D2 (burn) * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance / Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            message.channel.send(" * R2-D2 (self-dispel) * \n### Sets ### \n* Speed \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit. Chance / Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'resistancepilot':
            message.channel.send(" * Resistance Pilot * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'resistancetrooper':
            message.channel.send(" * Resistance Trooper * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'rey':
            message.channel.send(" * Rey * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Offense", {
                code: 'md'
            });
            break;
        case 'rg':
        case 'royalguard':
            message.channel.send(" * Royal Guard * \n### Sets ### \n* Health \n* Health \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'sabine':
        case 'sabinewren':
            message.channel.send(" * Sabine Wren * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'savage':
        case 'savageopress':
            message.channel.send(" * Savage Opress * \n### Sets ### \n* Health \n* Critical Chance \n* Critical Chance \n### Primaries ### \n* Square:   Crit. Chance \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Protection  / Potency", {
                code: 'md'
            });
            break;
        case 'srp':
        case 'scarifpathfinder':
        case 'pathfinder':
        case 'scarifrebelpathfinder':
            message.channel.send(" * Scarif Rebel Pathfinder * \n### Sets ### \n* Health \n* Defense \n* Defense### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'shore':
        case 'shoretrooper':
            message.channel.send(" * Shoretrooper (tank) * \n### Sets ### \n* Health \n* Health \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            message.channel.send(" * Shoretrooper (taunt) * \n### Sets ### \n* Tenacity \n* Tenacity \n* Tenacity \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed / Protection / Prot. \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Tenacity", {
                code: 'md'
            });
            break;
        case 'sa':
        case 'sithassassin':
            message.channel.send(" * Sith Assassin * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'st':
        case 'sithtrooper':
            message.channel.send(" * Sith Trooper * \n### Sets ### \n* Defense \n* Defense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            message.channel.send(" * Sith Trooper (Palp lead) * \n### Sets ### \n* Defense \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'snowtrooper':
            message.channel.send(" * Snowtrooper * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Offense / Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'stormtrooper':
            message.channel.send(" * Stormtrooper * \n### Sets ### \n* Defense \n* Defense \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Protection \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'sth':
        case 'sthan':
        case 'stormtrooperhan':
            message.channel.send(" * Stormtrooper Han * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'sf':
        case 'sun':
        case 'fac':
        case 'sunfac':
            message.channel.send(" * Sun Fac * \n### Sets ### \n* Health \n* Health \n* Defense \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed / Protection / Prot. \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection / Potency", {
                code: 'md'
            });
            break;
        case 'tfp':
        case 'tiepilot':
        case 'tiefighterpilot':
            message.channel.send(" * TIE Fighter Pilot * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'talia':
            message.channel.send(" * Talia * \n### Sets ### \n* Health \n* Health \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'teebo':
            message.channel.send(" * Teebo * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'raider':
        case 'tuskenraider':
            message.channel.send(" * Tusken Raider * \n### Sets ### \n* Offense \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'shaman':
        case 'tuskenshaman':
            message.channel.send(" * Tusken Shaman * \n### Sets ### \n* Speed \n* Health \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Protection", {
                code: 'md'
            });
            break;
        case 'urorrurrr':
            message.channel.send(" * URoRRuR'R'R * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'ugnaught':
            message.channel.send(" * Ugnaught * \n### Sets ### \n* Offense \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Protection \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
        case 'wedge':
        case 'wedgeantillies':
            message.channel.send(" * Wedge Antilles * \n### Sets ### \n* Critical Damage \n* Critical Chance \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Crit.Dmg. \n* Circle:   Protection \n* Cross:    Offense / Protection", {
                code: 'md'
            });
            break;
        case 'zam':
        case 'zam wessel':
            message.channel.send(" * Zam Wesell * \n### Sets ### \n* Speed \n* Potency \n### Primaries ### \n* Square:   Offense \n* Arrow:    Speed \n* Diamond:  Defense \n* Triangle: Offense \n* Circle:   Protection \n* Cross:    Potency", {
                code: 'md'
            });
            break;
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['m', 'mod'],
    permLevel: 0
};

exports.help = {
    name: 'mods',
    description: 'Shows the mods for a character',
    usage: 'mods [character]'
};


// Example
//message.channel.sendCode('md', `  * Aayla *
//### Sets ###
//* 3 x Crit Chance
//### Primaries ###
//* Square:   Offense
//* Arrow:    Speed
//* Diamond:  Defense
//* Triangle: Crit Chance
//* Circle:   Protection
//* Cross:    Potency`);
