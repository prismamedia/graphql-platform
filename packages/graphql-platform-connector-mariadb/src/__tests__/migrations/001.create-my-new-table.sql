START TRANSACTION;

  CREATE TABLE my_new_table (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  );

COMMIT;