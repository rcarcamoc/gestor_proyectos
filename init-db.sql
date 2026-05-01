CREATE DATABASE IF NOT EXISTS `smarttrack`;
CREATE DATABASE IF NOT EXISTS `web_finanzas`;
GRANT ALL PRIVILEGES ON `smarttrack`.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON `web_finanzas`.* TO 'user'@'%';
FLUSH PRIVILEGES;
