-- Optional sample data. Run after 0001_init.sql.
insert into public.customers (name, company, email, phone, status, city, country, notes)
values
  ('Amara Chen',     'Northwind Trading',   'amara@northwind.co',   '+1 415 555 0142', 'active',   'San Francisco', 'USA',     'Renewed annual plan in Q1.'),
  ('Liam Okafor',    'Okafor & Sons',       'liam@okaforsons.com',  '+44 20 7946 0958', 'lead',     'London',        'UK',      'Requested a demo of the reporting module.'),
  ('Sofia Marino',   'Marino Logistics',    'sofia@marinolog.it',   '+39 02 5550 1234', 'active',   'Milan',         'Italy',   'Key account — quarterly check-ins.'),
  ('Noah Patel',     'BrightPath Health',   'noah@brightpath.io',   '+1 312 555 0177', 'inactive', 'Chicago',       'USA',     'Churned in 2025, possible win-back.'),
  ('Yuki Tanaka',    'Tanaka Robotics',     'yuki@tanaka.jp',       '+81 3 5550 7788', 'lead',     'Tokyo',         'Japan',   'Evaluating against two competitors.');
