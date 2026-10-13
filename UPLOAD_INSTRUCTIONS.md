# Upload the AgriSmart source

Download `AgriSmart-Develop-clean.zip` from the ChatGPT response and extract it. In Command Prompt, open the extracted project folder, then run:

```bat
git init -b main
git add .
git commit -m "Upload AgriSmart project"
git remote add origin https://github.com/Jatinkanara21/Agrismart_final.git
git pull origin main --allow-unrelated-histories
git push -u origin main
```

If `git remote add origin` says `origin` already exists, run `git remote set-url origin https://github.com/Jatinkanara21/Agrismart_final.git` instead. Resolve any merge conflict before pushing. Do not commit `.env` files or credentials.
