# certs

`supabase-prod-ca-2021.crt` is Supabase's published root CA, fetched over verified HTTPS
from their downloads bucket:

```
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
```

Supabase's pooler serves a certificate issued by this root, which is not in any system
trust store — without it, node-postgres fails with
`self-signed certificate in certificate chain`.

Bundling it means TLS verification stays **on**. The alternative everyone reaches for,
`rejectUnauthorized: false`, accepts any certificate at all and hands the database
password to whoever answers the connection.

It is a public root certificate, not a secret. Valid until **2031-04-26**.
Also available in the Supabase dashboard: Project Settings → Database → SSL configuration.
