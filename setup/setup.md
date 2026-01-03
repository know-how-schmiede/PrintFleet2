# Setup (Debian 13 LXC)

Kurzanleitung fuer Linux-Anfaenger. Alle Befehle sind fuer root gedacht.

## 0) Als root anmelden

```bash
sudo -i
```

## 1) Vorbereitung (System updaten + Pakete installieren)

```bash
apt update
apt upgrade -y
apt install -y sudo git python3 python3-venv python3-pip build-essential ffmpeg acl
```

## 2) Repository holen

```bash
cd /root
git clone https://github.com/know-how-schmiede/PrintFleet2.git printfleet2
cd /root/printfleet2
```

Wenn die URL anders ist, ersetze sie entsprechend.

## 3) Skripte ausfuehrbar machen

```bash
chmod +x setup/setupPrintFleet2
chmod +x setup/setupPrintFleet2Service
chmod +x setup/setupPrintFleet2Telegram
chmod +x setup/updatePrintFleet2Service
```

## 4) Basis-Setup ausfuehren

Das Script fragt nach Benutzer, Installationspfad und Admin-Zugang.
Mit Enter werden Standardwerte uebernommen (Pfadangaben sind relativ zu /root).

```bash
./setup/setupPrintFleet2
```

Optional startet es den Dev-Server direkt im Terminal. Beende mit `Ctrl+C`.

## 5) Systemd-Service installieren

```bash
./setup/setupPrintFleet2Service
```

## 6) Telegram einrichten (optional)

Du wirst nach Bot-Token und Chat-ID gefragt. Danach wird der Dienst neu gestartet.

```bash
./setup/setupPrintFleet2Telegram
```

## 7) Service updaten

Stoppt den Dienst, holt Updates von Git, installiert Abhaengigkeiten,
migriert die Datenbank und startet den Dienst neu.

```bash
./setup/updatePrintFleet2Service
```
