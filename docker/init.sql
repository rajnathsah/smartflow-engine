-- Create target databases
CREATE DATABASE IF NOT EXISTS `billing_sync`;
CREATE DATABASE IF NOT EXISTS `synq_target_db`;

-- Grant privileges to root@% to allow connections from Docker network
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'rootpassword';
ALTER USER 'root'@'%' IDENTIFIED BY 'rootpassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Create dedicated user synq_user with password and full permissions
CREATE USER IF NOT EXISTS 'synq_user'@'%' IDENTIFIED BY 'password';
ALTER USER 'synq_user'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON *.* TO 'synq_user'@'%' WITH GRANT OPTION;

FLUSH PRIVILEGES;
