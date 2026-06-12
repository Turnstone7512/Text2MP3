# Text2MP3

純靜態網頁版文字轉 MP3 工具，改寫自原本的 Tkinter / `edge_tts` 小工具。

## 功能

- 輸入文字並選擇語速
- 選擇語音與 MP3 檔名
- 在瀏覽器端暫存文字、語速、語音、檔名
- 產生 MP3 後直接下載
- 預覽優先使用 Edge TTS MP3 音訊，失敗時才退回瀏覽器內建語音
- 不使用資料庫、不需要後端伺服器
- Edge TTS 失敗時，頁面下方會提供本地端 EXE 版本下載

## 使用方式

直接開啟 `index.html`，或上傳到 GitHub Pages。

若瀏覽器無法正常連線到 Edge TTS，請下載頁面下方顯示的 `20260608_Text2MP3_v7.exe`，使用本地端版本轉檔。

## GitHub Pages 部署

1. 將本資料夾內容推到 GitHub repository：`Turnstone7512/Text2MP3`
2. 到 GitHub repository 的 `Settings` → `Pages`
3. `Build and deployment` 選擇 `Deploy from a branch`
4. Branch 選擇 `main`，資料夾選擇 `/root`
5. 儲存後等待 GitHub Pages 發布

## 技術說明

這是純前端靜態網頁。資料會存在使用者自己的瀏覽器 `localStorage`，不會寫入資料庫。

MP3 產生和主要預覽會嘗試從瀏覽器連線到 Microsoft Edge Read Aloud 服務，流程與 Python `edge_tts` 類似。若瀏覽器、網路或服務端規則封鎖 WebSocket 連線，MP3 下載會失敗，預覽則會退回瀏覽器內建 Web Speech API；此 fallback 聲音會和 `en-US-EmmaNeural` 有明顯差異。
