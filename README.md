# MelonClient

Prosty launcher Minecraft w stylu z Twojego zrzutu ekranu, zbudowany w **Electron + Node.js**.

## Jak uruchomić w VS Code

1. Zainstaluj [Node.js](https://nodejs.org/) (wersja LTS) i **Java 21+** (potrzebna do uruchomienia samego Minecrafta).
2. Otwórz ten folder w VS Code.
3. W terminalu VS Code:
   ```bash
   npm install
   npm start
   ```

## Co jest zrobione

### Konta i profile — zapisywane na trwałe
Wszystkie konta i profile (nazwa, wersja, loader, RAM, mody, ikona) zapisują się automatycznie do plików JSON w folderze danych aplikacji (`accounts.json`, `profiles.json`, `settings.json`) i **zostają po zamknięciu i ponownym otwarciu programu**. Nie trzeba nic dodatkowo klikać, żeby "zapisać" — dzieje się to przy każdej zmianie.

### Zakładka Profiles
- Kafelki profili w stylu Lunar Client.
- **+ Dodaj profil** — nazwa, wersja Minecrafta (pobierana na żywo z Mojanga), loader (Vanilla/Fabric/Forge/Quilt), **własna ikona profilu** (wybierasz dowolny obrazek z dysku, podgląd od razu widoczny, ikona zapisuje się razem z profilem).
- Klik lewym = wybór aktywnego profilu. Klik prawym = menu: Opcje / Uruchom / Zmień nazwę / Usuń.
- Opcje → Ogólne: zmiana loadera, suwaki RAM. Opcje → Mody: wyszukiwarka Modrinth/CurseForge, zaznaczanie kartą lub ptaszkiem, przycisk "Dodaj mody".

### Interfejs
- Przycisk PLAY, przełącznik konta i przycisk logów (📄) delikatnie się powiększają po najechaniu myszką i wracają do normalnego rozmiaru po zjechaniu — czytelna informacja, że są klikalne.

### Przycisk PLAY ↔ ZAMKNIJ
Gdy Minecraft działa, przycisk **PLAY zmienia się w czerwony "ZAMKNIJ"**. Kliknięcie go **wymusza zakończenie procesu** (jak "Zakończ zadanie" w Menadżerze Zadań Windows — `taskkill /F /T`) — działa nawet, jeśli gra się zawiesiła i nie reaguje na normalne zamknięcie okna.

### Uruchamianie Minecrafta — działa naprawdę
Przycisk **PLAY** (i "Uruchom" z menu kontekstowego) faktycznie:
- **najpierw sprawdza, czy Java w ogóle działa** (i mówi wprost, jeśli nie — zamiast ciszy),
- pobiera pliki gry dla wybranej wersji (przy pierwszym uruchomieniu danej wersji),
- loguje jako Twoje konto offline (nick),
- odpala proces Minecrafta i pilnuje jego zamknięcia/błędów,
- pokazuje na żywo okno z logiem pobierania/uruchamiania.

**Ikona 📄 obok przycisku PLAY** otwiera podgląd logów w dowolnym momencie — nie musisz czekać na start gry, żeby je zobaczyć, i logi zostają widoczne nawet po zamknięciu i ponownym otwarciu okna logów (aż do kolejnego uruchomienia gry).

**Logi są kolorowane** — nie cała linia, tylko konkretny fragment tekstu:
- 🟣 **fioletowy** = coś poszło dobrze (np. "OK", "Downloaded assets", "Set launch options"),
- 🔴 **czerwony** = błąd (np. "Error", "Exception", "BŁĄD"),
- 🟠 **pomarańczowy** = konflikt / ostrzeżenie (np. "warning", "conflict", "duplicate").

**Automatyczne sprawdzanie wersji Javy — i automatyczne pobieranie, jeśli jej brakuje.** To jest kluczowa zmiana: **nikt nie musi ręcznie instalować Javy**, ani Ty, ani osoby, którym udostępnisz MelonClienta. Kolejność działania przy każdym uruchomieniu gry:
1. Jeśli w **Settings** ustawiona jest ręczna ścieżka do Javy i spełnia wymagania danej wersji Minecrafta — używa jej.
2. Jeśli nie, sprawdza Javę dostępną w systemie (PATH) — jeśli jest wystarczająca, używa jej.
3. Jeśli nigdzie nie ma pasującej Javy, **MelonClient sam pobiera własną, prywatną Javę** (dokładnie tę samą, której używa oficjalny launcher Mojanga) do folderu danych aplikacji i używa jej — dzieje się to raz na daną wersję Javy, w tle, z paskiem postępu widocznym w oknie logów.

Dzięki temu możesz spokojnie wysłać ten projekt (albo gotową paczkę) koledze — nie musi niczego wcześniej pobierać ani konfigurować, MelonClient załatwi to sam przy pierwszym kliknięciu PLAY.

Jeśli po pobraniu assetów gra się nie odpala — otwórz logi (📄) i sprawdź, czy nie ma tam błędu Javy (np. błędu LWJGL/natywnych bibliotek, albo problemu z pobieraniem — sprawdź połączenie z internetem).

**Fabric, Forge i Quilt teraz też działają naprawdę** — nie tylko Vanilla:
- **Fabric / Quilt** — MelonClient pobiera najnowszy stabilny loader z oficjalnego API (meta.fabricmc.net / meta.quiltmc.org) i przygotowuje gotowy profil wersji, dokładnie tak jak robi to oficjalny launcher przy instalacji Fabric/Quilt.
- **Forge** — MelonClient sam sprawdza rekomendowaną wersję Forge dla wybranej wersji Minecrafta, pobiera oficjalny instalator z serwerów Forge i przekazuje go do silnika uruchamiającego, który sam wykonuje kroki instalacji (patchowanie bibliotek itd.) — nie musisz nic klikać ręcznie.

Wszystko to dzieje się automatycznie przy pierwszym uruchomieniu danego profilu (kolejne razy są dużo szybsze, bo pliki zostają w cache). Ewentualne mody dodane w zakładce Profile → Opcje → Mody trzeba jeszcze ręcznie wrzucić do folderu `mods` danej instancji (w `%AppData%/MelonClient/instances/<id>/mods`) — automatyczne wgrywanie ściągniętych z Modrinth/CurseForge modów do folderu gry to dobry temat na kolejny krok, jeśli chcesz.

### Ustawienia
- Klucz API CurseForge (opcjonalny, potrzebny tylko do wyszukiwania modów z CurseForge — Modrinth działa bez klucza).
- Ścieżka do Java (opcjonalna — zostaw puste, jeśli Java jest dodana do PATH systemowego).

## Struktura projektu
```
melonclient/
├── main.js          # proces główny Electron (okno, zapisywanie danych, uruchamianie gry)
├── preload.js        # bezpieczny "most" między main a interfejsem
├── package.json
└── src/
    ├── index.html
    ├── style.css
    └── renderer.js
```

### Konta Premium (Microsoft)
Na stronie **Accounts** jest przycisk **"Zaloguj przez Microsoft (Premium)"** — otwiera prawdziwe okno logowania Microsoft (dokładnie takie samo okno, jak w oficjalnym launcherze). Po zalogowaniu konto działa jako pełnoprawne konto Premium: gra uruchamia się w trybie online, na prawdziwym UUID z Mojanga.

**Uwaga:** token logowania jest ważny około 24h. Jeśli po dłuższej przerwie coś się nie zaloguje przy starcie gry, po prostu kliknij "Zaloguj przez Microsoft" jeszcze raz — to jednorazowa operacja na kilka sekund.

### Skiny i peleryny
Kliknij **prawym przyciskiem myszy na konto** w zakładce Accounts → **Opcje**:
- **Własny skin (.png)** — dla konta Premium plik jest wysyłany prawdziwym, oficjalnym API Mojanga, więc widzą go **wszyscy gracze, wszędzie** (tak jak w prawdziwym launcherze). Dla konta offline/non-premium skin zapisuje się **tylko lokalnie** i jest widoczny wyłącznie w tym MelonClient na tym komputerze.
- **Peleryny (tylko Premium)** — lista peleryn, które naprawdę posiadasz na koncie Mojang, z możliwością włączenia jednej z nich (też przez oficjalne API — widoczne dla wszystkich).

**Ważna, uczciwa uwaga o non-premium:** żeby gracze premium widzieli customowy skin konta offline/crack **na serwerze**, sam launcher tego nie załatwi — real Minecraft (także premium) pyta o skin bezpośrednio Mojanga po UUID konta. Jedyny uniwersalny sposób, żeby wszyscy widzieli ten sam custom skin niezależnie od launchera, to zainstalowanie na serwerze wtyczki typu **SkinsRestorer**, która sama nadpisuje wyświetlany skin każdemu graczowi. To nie jest ograniczenie tego klienta — to jak działa protokół Minecrafta.


### Naprawione w tej wersji
- **Mody faktycznie się teraz instalują.** Wcześniej dodanie moda w Opcjach → Mody tylko zapisywało go na liście — teraz przy każdym uruchomieniu profilu MelonClient sam pobiera pasujący plik `.jar` (dopasowany do wersji Minecrafta i loadera) z Modrinth albo CurseForge i wrzuca go do folderu `mods` tej instancji. Zobaczysz to w logach (📄) jako `OK: zainstalowano mod "..."`.
- **Pasek na dole naprawiony** — był bug z nakładającymi się tekstami (flex `justify-content:center` gryzł się z `position:absolute`). Teraz to porządny układ 3-kolumnowy, nic się nie nakłada.
- **"Otwórz Folder"** — nowa opcja w menu kontekstowym (prawy klik) na kafelku **profilu gry** (nie konta) — otwiera folder tej konkretnej instancji w eksploratorze plików.
- **Konsola (📄):** doszły przyciski **🧹 Wyczyść** i **📋 Kopiuj** (kopiuje całą zawartość do schowka).
- **Więcej wersji Minecrafta** — lista przy tworzeniu profilu nie jest już ucięta do 60 najnowszych, tylko pokazuje pełną historię wersji release (sięga dużo dalej niż 1.7). Jest też checkbox **"Pokaż też snapshoty"**, jeśli chcesz wersje testowe.

### System znajomych — dlaczego jeszcze go nie ma
To była ostatnia rzecz z Twojej listy i musisz o tym wiedzieć: **znajomi między różnymi komputerami wymagają prawdziwego serwera w internecie** (bazy danych + czegoś, co na bieżąco wie, kto jest online i co robi). Sam plik .exe uruchomiony u Ciebie i u kolegi nie ma jak się nawzajem "zobaczyć" bez wspólnego miejsca w sieci, w którym obie strony się meldują. To nie jest ograniczenie tego kodu — to jak działają wszystkie tego typu funkcje (Discord, launchery z listami znajomych itd.) pod spodem.

**Sensowna, tania droga do tego:** darmowy hostowany backend (np. Firebase Realtime Database albo Supabase) — obsłuży listę znajomych, zaproszenia i status online/w grze bez płacenia za własny serwer. Wymaga tylko, żebyś założył darmowe konto na jednej z tych platform i podał mi klucz konfiguracyjny — resztę (kod po stronie MelonClienta) ogarnę. Daj znać, czy chcesz iść w tę stronę, to zabieram się za to jako osobny, spory krok.


Twoje logo (`src/assets/logo.png`) jest teraz w navbarze zamiast emotki, a ikona okna aplikacji (i paska zadań na Windows) też używa Twojego loga — wygenerowałem z niego dodatkowo plik `src/assets/icon.ico` (wielorozmiarowy, jak wymaga Windows). Plik faktycznie ma poprawne przezroczyste tło (sprawdziłem kanał alfa) — białe tło, które widziałeś, to był tylko podgląd w czacie, nie wada pliku.

Jeśli kiedyś będziemy pakować MelonClienta do instalatora (`electron-builder`), ten sam `icon.ico` posłuży też jako ikona pliku .exe — nic nie trzeba będzie zmieniać.



### Instalator Windows (jak CurseForge) — z Twoim logo i wyborem języka
Dodałem `electron-builder`, który buduje prawdziwy instalator `.exe` (NSIS) — ten sam typ kreatora co używa CurseForge, Twitch Desktop i wiele innych launcherów: strona powitalna, wybór folderu, pasek postępu, strona końcowa, z przyciskami Wstecz/Dalej.

**Co jest już ustawione:**
- Ikona instalatora, ikona odinstalowywania i mała ikonka nad paskiem postępu — wszystko z Twojego loga.
- Boczny obrazek na stronie powitalnej/końcowej — wygenerowany z Twojego loga na ciemnym tle w kolorze motywu klienta.
- **Wybór języka na starcie instalatora — Angielski i Polski** (dokładnie jak na Twoim zrzucie ekranu z CurseForge).
- Spersonalizowany tytuł i tekst strony powitalnej ("Witaj w MelonClient...").
- Możliwość zmiany folderu instalacji, skrót na pulpicie i w Menu Start.

**Jak zbudować instalator:**
```bash
npm install
npm run dist:win
```
Gotowy plik `.exe` znajdzie się w folderze `dist_installer/`. To on jest tym, co wysyłasz koledze — klika go, przechodzi przez kreator (z wyborem języka), i ma zainstalowanego MelonClienta jak każdy inny prawdziwy program.

**Jeśli build na Windows wywala błąd o "Cannot create symbolic link" / winCodeSign** — to znany, częsty problem `electron-builder`: próbuje rozpakować paczkę z narzędziami do podpisywania na macOS, a ta zawiera linki symboliczne, których zwykły użytkownik Windows nie ma prawa tworzyć. Nie ma to nic wspólnego z Twoim kodem. Napraw jednym z dwóch sposobów:

1. **Włącz Tryb Dewelopera w Windows** (zalecane, raz na zawsze): Ustawienia → Prywatność i zabezpieczenia → Dla deweloperów → włącz "Tryb dewelopera". Potem jeszcze raz `npm run dist:win`.
2. **Albo** uruchom terminal (PowerShell/CMD) **jako Administrator** i wywołaj `npm run dist:win` z niego.

Jeśli wcześniej próba się nie powiodła, usuń jeszcze folder z cache przed ponowną próbą:
```powershell
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
```

### Build na Linuksie (dla kolegi)
Skoro kolega przechodzi na Linuksa — sam MelonClient **już działa na Linuksie bez żadnych zmian w kodzie** (cała ścieżka do Javy, zabijanie procesu, ikony itd. rozróżniają system operacyjny automatycznie). Może po prostu:
```bash
npm install
npm start
```

Jeśli wolicie mu dać gotowy, zapakowany plik zamiast każenia klonować repo:
```bash
npm run dist:linux
```
Zbuduje **AppImage** — pojedynczy plik `.AppImage`, który działa na prawie każdej dystrybucji Linuksa bez instalacji. Kolega odpala go tak:
```bash
chmod +x MelonClient-*.AppImage
./MelonClient-*.AppImage
```
Gotowy plik znajdzie się w `dist_installer/` (tak jak wersja Windows).



## Instalacja jedną komendą na Linuksie
Na Linuksie nie ma "instalatorów" typu .exe — normalną praktyką (Discord, VS Code itd. robią to samo) jest albo ręczne pobranie i uruchomienie AppImage, albo jedna komenda w terminalu, która robi to automatycznie. Zrobiłem oba warianty.

**Wariant A — ręcznie, bez instalowania (najprostszy, zawsze zadziała):**
```bash
wget https://github.com/TWOJ_NICK/melonclient/releases/latest/download/MelonClient-x86_64.AppImage
chmod +x MelonClient-x86_64.AppImage
./MelonClient-x86_64.AppImage
```

**Wariant B — jedna komenda, instaluje na stałe (skrót w menu + komenda `melonclient` w terminalu):**
```bash
curl -sL https://raw.githubusercontent.com/TWOJ_NICK/melonclient/main/scripts/install-linux.sh | bash
```
Ten skrypt (`scripts/install-linux.sh` w projekcie) sam pobiera najnowszą wersję z GitHub Releases, dodaje ją do menu aplikacji z ikoną i tworzy komendę `melonclient`.

**Zanim to komukolwiek wyślesz, koniecznie:**
1. Wrzuć projekt na GitHub (może być publiczne repo).
2. Zbuduj `.AppImage` (`npm run dist:linux` na maszynie z Linuksem) i wrzuć go jako załącznik do **GitHub Release** (Releases → Create a new release → dołącz plik).
3. W pliku `scripts/install-linux.sh` podmień `TWOJ_NICK/melonclient` na prawdziwą nazwę swojego repo (linia `GITHUB_REPO=`), tak samo w komendach w tym README.

Bez tego kroku (prawdziwe repo + prawdziwy Release z załączonym plikiem) obie komendy powyżej nie będą miały czego pobrać.



Skoro MelonClient ma trafić do szerszego grona, kilka rzeczy wartych ogarnięcia:

### SmartScreen / Windows Defender pokaże ostrzeżenie
Instalator **nie jest podpisany cyfrowo** (podpisywanie kodu kosztuje — certyfikat EV/OV to zwykle 70-300$/rok). Bez tego, przy pierwszym uruchomieniu .exe, ludzie zobaczą niebieski ekran "Windows chronił Twój komputer" z przyciskiem "Więcej informacji" → "Uruchom mimo to". To normalne dla niezależnych, niepodpisanych aplikacji (wiele małych launcherów tak ma) — warto tylko **uprzedzić o tym w opisie/instrukcji**, żeby ludzie się nie wystraszyli i nie pomyśleli, że to wirus.

### Antywirusy mogą fałszywie oznaczyć plik
Aplikacje Electron (szczególnie nowe, mało pobierane) czasem dostają fałszywy alarm od niektórych antywirusów, bo są "nieznane" (mała reputacja pliku). To mija z czasem/popularnością. Jeśli ktoś zgłosi taki alert, to najpewniej fałszywy positive, nie realne zagrożenie.

### Logowanie Microsoft na większą skalę
Obecne logowanie Microsoft używa domyślnego, współdzielonego identyfikatora aplikacji z biblioteki `msmc` (tego samego, którego używa wiele innych open-source'owych launcherów). Dla kilku-kilkunastu osób to bez znaczenia. Jeśli MelonClient naprawdę się rozrośnie (setki/tysiące użytkowników), warto założyć **własną rejestrację aplikacji w Azure** (darmowe, ale wymaga konta Microsoft/Azure) i użyć własnego client ID — zabezpiecza to przed rzadkim, ale możliwym, wspólnym limitem zapytań. To nie jest pilne teraz, ale zapisz to sobie na później.

### Gdzie to hostować, żeby ludzie mogli pobrać
Najprostsza, darmowa opcja: **GitHub Releases**. Zakładasz publiczne repo na GitHubie (kod może być publiczny albo prywatny — Releases działają niezależnie), wrzucasz zbudowany `.exe` i `.AppImage` jako załączniki do release'u, i wysyłasz ludziom link do strony release'u. GitHub hostuje pliki za darmo, bez limitów pobrań dla normalnego ruchu.

## Co dodać w kolejnych krokach (do ustalenia z Tobą)


- Custom peleryny samego MelonClienta (osobne od peleryn Mojanga) — wspominałeś, że to zrobisz sam później.
- Automatyczne wgrywanie modów pobranych z Modrinth/CurseForge bezpośrednio do folderu `mods` instancji.
- Prawdziwe zdjęcia autorów modów zamiast inicjałów.
