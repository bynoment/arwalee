import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.news();  // Haberleri ilk başta yükleyelim
        this.socialLick();
        this.instancesSelect();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'));
        this.updateAvatar();  // Avatarı sağ üst köşeye ekleyelim
        this.setupOfflineLogin();  // Offline login kısmı için setup fonksiyonunu çağırıyoruz

        // Yenile butonuna tıklama olayı ekle
        document.getElementById('refresh-news').addEventListener('click', () => this.news());
    }

    // Minotar API'sinden avatar URL'sini almak
    async getPlayerAvatar(nick) {
        return `https://minotar.net/avatar/${nick}/100`; // Minotar avatar URL'si
    }

    // Avatarı sağ üst köşeye eklemek için fonksiyon
    async updateAvatar() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let playerNick = auth.nick; // Seçilen oyuncunun nick'ini alıyoruz

        let avatarUrl = await this.getPlayerAvatar(playerNick); // Minotar API'sinden avatar URL'sini alıyoruz

        // Avatarı sağ üst köşedeki player-head div'ine ekliyoruz
        document.querySelector(".player-head").style.backgroundImage = `url(${avatarUrl})`;
    }

    // Offline login işlemi
    setupOfflineLogin() {
        let offlineLoginButton = document.querySelector('.connect-offline');
        offlineLoginButton.addEventListener('click', async () => {
            let playerNick = document.querySelector('.email-offline').value;  // Girdiği nick'i alıyoruz

            if (playerNick) {
                let avatarUrl = await this.getPlayerAvatar(playerNick);  // Minotar API'sinden avatar URL'sini alıyoruz
                document.querySelector(".player-head").style.backgroundImage = `url(${avatarUrl})`;  // Avatarı güncelliyoruz

                // Offline giriş işlemi yapılabilir (örneğin, kullanıcı adı ve avatar verisini kaydetme işlemi)
                console.log(`Offline giriş yapan oyuncu: ${playerNick}`);
            } else {
                alert("Lütfen bir kullanıcı adı giriniz.");
            }
        });
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);
        if (news) {
            newsElement.innerHTML = ''; // Önceki haberleri temizle
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-content">
                        <p>Şu anda herhangi bir haber mevcut değil. Sunucu ile ilgili tüm haberleri buradan takip edebilirsiniz.</p>
                    </div>`;
                newsElement.appendChild(blockNews);
            } else {
                // Haberleri id'ye göre büyükten küçüğe sırala
                news.sort((a, b) => b.id - a.id);

                news.forEach((item, index) => {
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');

                    // En yeni 3 haberi renklendir
                    if (index === 0) {
                        blockNews.style.backgroundColor = 'rgba(255, 193, 7, 0.2)'; // Sarı
                    } else if (index === 1) {
                        blockNews.style.backgroundColor = 'rgba(255, 165, 0, 0.2)'; // Turuncu
                    } else if (index === 2) {
                        blockNews.style.backgroundColor = 'rgba(255, 99, 71, 0.2)'; // Kırmızı
                    }

                    blockNews.innerHTML = `
                        <div class="news-content">
                            <p>${item.content}</p>
                        </div>`;
                    newsElement.appendChild(blockNews);
                });
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-content">
                    <p>Haberlere ulaşılamıyor. Daha sonra tekrar deneyiniz.</p>
                </div>`;
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let instancesList = await config.getInstanceList()
        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct) ? configClient?.instance_selct : null

        let instanceBTN = document.querySelector('.play-instance')
        let instancePopup = document.querySelector('.instance-popup')
        let instancesListPopup = document.querySelector('.instances-List')
        let instanceCloseBTN = document.querySelector('.close-popup')

        if (instancesList.length === 1) {
            document.querySelector('.instance-select').style.display = 'none'
            instanceBTN.style.paddingRight = '0'
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
            let configClient = await this.db.readData('configClient')
            configClient.instance_selct = newInstanceSelect.name
            instanceSelect = newInstanceSelect.name
            await this.db.updateData('configClient', configClient)
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        let configClient = await this.db.readData('configClient')
                        configClient.instance_selct = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        setStatus(newInstanceSelect.status)
                        await this.db.updateData('configClient', configClient)
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`)
            if (instance.name == instanceSelect) setStatus(instance.status)
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id
                let activeInstanceSelect = document.querySelector('.active-instance')

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect
                await this.db.updateData('configClient', configClient)
                instanceSelect = instancesList.filter(i => i.name == newInstanceSelect)
                instancePopup.style.display = 'none'
                let instance = await config.getInstanceList()
                let options = instance.find(i => i.name == configClient.instance_selct)
                await setStatus(options.status)
            }
        })

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')
            let instanceSelect = configClient.instance_selct
            let auth = await this.db.readData('accounts', configClient.account_selected)

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = ''
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                            if (whitelist == auth?.name) {
                                if (instance.name == instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                                }
                            }
                        })
                    } else {
                        if (instance.name == instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                        }
                    }
                }

                instancePopup.style.display = 'flex'
            }

            if (!e.target.classList.contains('instance-select')) this.startGame()
        })

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')
    }

    async startGame() {
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instance = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name == configClient.instance_selct)

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type == 'none' ? false : true
            },

            verify: options.verify,

            ignored: [...options.ignored],

            javaPath: configClient.java_config.java_path,

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        launch.Launch(opt);

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load')
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Agustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}

export default Home;
