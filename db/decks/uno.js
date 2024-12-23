const unoCards = [
    {name: "0", type: "Red", suit: "Red", value: 0, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-2fed6168-a6b5-4dd2-9d66-d1dcd60d66ab?alt=media&token=f954e409-83fa-4628-9955-76557ca893e7"},
    {name: "1", type: "Red", suit: "Red", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-8f5db348-a724-40a7-b58c-8dcd5198aa7d?alt=media&token=207f4e0d-7dd1-4d3e-b9eb-1438e10af898"},
    {name: "2", type: "Red", suit: "Red", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-89c07043-d89d-466d-ab14-e172081a9e0d?alt=media&token=ed3fe092-b63a-4219-bfdd-e3e6da423893"},
    {name: "3", type: "Red", suit: "Red", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-fcf8d52b-4a02-4900-aea2-d5b46d7f066c?alt=media&token=8bbe4407-4294-4249-86fe-d0bd6cbfd31e"},
    {name: "4", type: "Red", suit: "Red", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a1948ef2-3b9b-4506-8a10-046d030572ff?alt=media&token=9e9e64cf-5852-4677-902f-d2b08320f1af"},
    {name: "5", type: "Red", suit: "Red", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0211ae21-f148-4a5a-8bdd-ef61df7799ce?alt=media&token=7f7ec242-8822-4a05-b8ea-c6e6fd1a4ab8"},
    {name: "6", type: "Red", suit: "Red", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-216b6b06-c439-49f9-9ff4-46079ef1a0bf?alt=media&token=a9d7287a-3c93-4512-9f22-7ce6dc250421"},
    {name: "7", type: "Red", suit: "Red", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-05b68b3b-5c42-4421-b361-854927c59e6e?alt=media&token=436675d4-ad0e-4e20-8e4e-87a01d457cae"},
    {name: "8", type: "Red", suit: "Red", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-609438fb-db2e-4269-844f-1017eb3a602c?alt=media&token=26a3dde5-e47e-4d6d-8f32-32d1fdeb5c1f"},
    {name: "9", type: "Red", suit: "Red", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-cb1b2ca9-5c01-4998-af9d-96f82ba1cbe2?alt=media&token=2793f281-f86d-4169-b0b6-bcd4fbe1675c"},
    {name: "1", type: "Red", suit: "Red", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-8f5db348-a724-40a7-b58c-8dcd5198aa7d?alt=media&token=207f4e0d-7dd1-4d3e-b9eb-1438e10af898"},
    {name: "2", type: "Red", suit: "Red", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-89c07043-d89d-466d-ab14-e172081a9e0d?alt=media&token=ed3fe092-b63a-4219-bfdd-e3e6da423893"},
    {name: "3", type: "Red", suit: "Red", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-fcf8d52b-4a02-4900-aea2-d5b46d7f066c?alt=media&token=8bbe4407-4294-4249-86fe-d0bd6cbfd31e"},
    {name: "4", type: "Red", suit: "Red", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a1948ef2-3b9b-4506-8a10-046d030572ff?alt=media&token=9e9e64cf-5852-4677-902f-d2b08320f1af"},
    {name: "5", type: "Red", suit: "Red", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0211ae21-f148-4a5a-8bdd-ef61df7799ce?alt=media&token=7f7ec242-8822-4a05-b8ea-c6e6fd1a4ab8"},
    {name: "6", type: "Red", suit: "Red", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-216b6b06-c439-49f9-9ff4-46079ef1a0bf?alt=media&token=a9d7287a-3c93-4512-9f22-7ce6dc250421"},
    {name: "7", type: "Red", suit: "Red", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-05b68b3b-5c42-4421-b361-854927c59e6e?alt=media&token=436675d4-ad0e-4e20-8e4e-87a01d457cae"},
    {name: "8", type: "Red", suit: "Red", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-609438fb-db2e-4269-844f-1017eb3a602c?alt=media&token=26a3dde5-e47e-4d6d-8f32-32d1fdeb5c1f"},
    {name: "9", type: "Red", suit: "Red", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-cb1b2ca9-5c01-4998-af9d-96f82ba1cbe2?alt=media&token=2793f281-f86d-4169-b0b6-bcd4fbe1675c"},

    
    {name: "0", type: "Yellow", suit: "Yellow", value: 0, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-47901434-1340-42ce-8748-925ab40d7432?alt=media&token=36f22155-210e-417d-9599-8a786a770e89"},
    {name: "1", type: "Yellow", suit: "Yellow", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0cb17d1a-ab73-4e94-bedf-14737d089bae?alt=media&token=d9cfd99e-d379-4557-9d6f-4282b8d8dde7"},
    {name: "2", type: "Yellow", suit: "Yellow", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9a797c44-59c7-472f-b1b1-43e3cc993eae?alt=media&token=285c24ff-6c87-43ae-95bd-dc4fd99c67fa"},
    {name: "3", type: "Yellow", suit: "Yellow", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-5cb5c0dd-f44a-4bcb-9986-22e5b9dff1ae?alt=media&token=e939c78b-9b85-4ba8-bafa-8cf8ba03b534"},
    {name: "4", type: "Yellow", suit: "Yellow", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a4c135cc-7aab-4622-a4f5-3227168e3f49?alt=media&token=0a80c622-62d4-4eb0-9345-fd5fefbc9e72"},
    {name: "5", type: "Yellow", suit: "Yellow", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-e2c4b734-37e6-43ea-a68a-663b9a17d48d?alt=media&token=15dffcec-6066-43f0-bddc-ff9e08d3a387"},
    {name: "6", type: "Yellow", suit: "Yellow", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-c8837c2a-88ed-45e5-b228-157f63342230?alt=media&token=51786b13-6385-45d6-a7a9-3c3d3ca4500b"},
    {name: "7", type: "Yellow", suit: "Yellow", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-7aecc65e-458c-44e9-aaa5-67fe91974b07?alt=media&token=93cdfadb-105c-4efc-a2c8-24d8a34ff021"},
    {name: "8", type: "Yellow", suit: "Yellow", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-34a312f7-df23-4f32-b672-c0e7a2557405?alt=media&token=baa62b63-4592-4b30-9aa1-9a68ceadc2db"},
    {name: "9", type: "Yellow", suit: "Yellow", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-5aa01b5c-74a3-41ad-bd09-058b29d7eeeb?alt=media&token=f5f746b9-5ca4-4657-b388-e3ef7b1a109d"},
    {name: "1", type: "Yellow", suit: "Yellow", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0cb17d1a-ab73-4e94-bedf-14737d089bae?alt=media&token=d9cfd99e-d379-4557-9d6f-4282b8d8dde7"},
    {name: "2", type: "Yellow", suit: "Yellow", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9a797c44-59c7-472f-b1b1-43e3cc993eae?alt=media&token=285c24ff-6c87-43ae-95bd-dc4fd99c67fa"},
    {name: "3", type: "Yellow", suit: "Yellow", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-5cb5c0dd-f44a-4bcb-9986-22e5b9dff1ae?alt=media&token=e939c78b-9b85-4ba8-bafa-8cf8ba03b534"},
    {name: "4", type: "Yellow", suit: "Yellow", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a4c135cc-7aab-4622-a4f5-3227168e3f49?alt=media&token=0a80c622-62d4-4eb0-9345-fd5fefbc9e72"},
    {name: "5", type: "Yellow", suit: "Yellow", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-e2c4b734-37e6-43ea-a68a-663b9a17d48d?alt=media&token=15dffcec-6066-43f0-bddc-ff9e08d3a387"},
    {name: "6", type: "Yellow", suit: "Yellow", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-c8837c2a-88ed-45e5-b228-157f63342230?alt=media&token=51786b13-6385-45d6-a7a9-3c3d3ca4500b"},
    {name: "7", type: "Yellow", suit: "Yellow", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-7aecc65e-458c-44e9-aaa5-67fe91974b07?alt=media&token=93cdfadb-105c-4efc-a2c8-24d8a34ff021"},
    {name: "8", type: "Yellow", suit: "Yellow", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-34a312f7-df23-4f32-b672-c0e7a2557405?alt=media&token=baa62b63-4592-4b30-9aa1-9a68ceadc2db"},
    {name: "9", type: "Yellow", suit: "Yellow", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-5aa01b5c-74a3-41ad-bd09-058b29d7eeeb?alt=media&token=f5f746b9-5ca4-4657-b388-e3ef7b1a109d"},
  
  
    {name: "0", type: "Green", suit: "Green", value: 0, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-e49eaa8e-0c7d-4d7a-8938-ac5a7e9a149d?alt=media&token=08cc23a6-caf4-42ec-a4aa-06cf7902623d"},
    {name: "1", type: "Green", suit: "Green", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-cb1a1092-c463-4d99-b4c1-28f26bb06bc8?alt=media&token=e21f7321-6b12-403a-8808-edfc0f18637e"},
    {name: "2", type: "Green", suit: "Green", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0360510b-c8d4-4af3-84cf-c67e77de2bee?alt=media&token=c407b42c-9b50-4315-aad9-5fe909ee6fe3"},
    {name: "3", type: "Green", suit: "Green", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b92c37ce-9b8b-479d-b295-3db7ba5140d7?alt=media&token=1e00bcee-3994-4789-bed6-74051397e311"},
    {name: "4", type: "Green", suit: "Green", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-62b9566f-47f3-48db-bc20-3649f643d5d3?alt=media&token=49146870-2b13-49f0-8b36-5b9723a19e5b"},
    {name: "5", type: "Green", suit: "Green", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-fed7c7b1-7b9e-4380-b520-4b86956e49e5?alt=media&token=187e2604-6220-4452-9e55-afbfbbe3d746"},
    {name: "6", type: "Green", suit: "Green", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-87247d7c-a58b-45a7-92a1-aa3c348d7711?alt=media&token=24a1a1d3-4342-47f3-a0cf-797c5f2db596"},
    {name: "7", type: "Green", suit: "Green", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-2286c5b4-bca1-4424-8301-f1e697001bf9?alt=media&token=5d5be8ed-62c1-4a0e-b61d-fd0bbf26753e"},
    {name: "8", type: "Green", suit: "Green", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3161cc19-25d6-4cbb-822f-f48cd1a72849?alt=media&token=aa48b192-13f2-43f8-b88e-3d5b920b82f4"},
    {name: "9", type: "Green", suit: "Green", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a52f7a49-9eec-4ad6-987c-0d29452ed421?alt=media&token=cb0bdfe4-fd2e-43f3-b553-4e8e94a3cf57"},
    {name: "1", type: "Green", suit: "Green", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-cb1a1092-c463-4d99-b4c1-28f26bb06bc8?alt=media&token=e21f7321-6b12-403a-8808-edfc0f18637e"},
    {name: "2", type: "Green", suit: "Green", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0360510b-c8d4-4af3-84cf-c67e77de2bee?alt=media&token=c407b42c-9b50-4315-aad9-5fe909ee6fe3"},
    {name: "3", type: "Green", suit: "Green", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b92c37ce-9b8b-479d-b295-3db7ba5140d7?alt=media&token=1e00bcee-3994-4789-bed6-74051397e311"},
    {name: "4", type: "Green", suit: "Green", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-62b9566f-47f3-48db-bc20-3649f643d5d3?alt=media&token=49146870-2b13-49f0-8b36-5b9723a19e5b"},
    {name: "5", type: "Green", suit: "Green", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-fed7c7b1-7b9e-4380-b520-4b86956e49e5?alt=media&token=187e2604-6220-4452-9e55-afbfbbe3d746"},
    {name: "6", type: "Green", suit: "Green", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-87247d7c-a58b-45a7-92a1-aa3c348d7711?alt=media&token=24a1a1d3-4342-47f3-a0cf-797c5f2db596"},
    {name: "7", type: "Green", suit: "Green", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-2286c5b4-bca1-4424-8301-f1e697001bf9?alt=media&token=5d5be8ed-62c1-4a0e-b61d-fd0bbf26753e"},
    {name: "8", type: "Green", suit: "Green", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3161cc19-25d6-4cbb-822f-f48cd1a72849?alt=media&token=aa48b192-13f2-43f8-b88e-3d5b920b82f4"},
    {name: "9", type: "Green", suit: "Green", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-a52f7a49-9eec-4ad6-987c-0d29452ed421?alt=media&token=cb0bdfe4-fd2e-43f3-b553-4e8e94a3cf57"},
 
 
    {name: "0", type: "Blue", suit: "Blue", value: 0, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9ede638a-bc4b-4999-ae3e-2a64bc32a828?alt=media&token=10e3f2af-01a5-4d1b-919c-2a9b1ebb9248"},
    {name: "1", type: "Blue", suit: "Blue", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-17f2db52-c170-47fe-9678-a368842b8580?alt=media&token=8e67557e-8516-48e3-b844-528f284b7ae6"},
    {name: "2", type: "Blue", suit: "Blue", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-37ae8467-3c89-40bc-91fb-f2f9452467b7?alt=media&token=321200d8-4f82-4929-bd7e-4043e7524202"},
    {name: "3", type: "Blue", suit: "Blue", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-7281074f-6ba5-47be-8527-991e5e33a550?alt=media&token=c8a1eb6b-5c32-448f-a7a6-b0089887fd25"},
    {name: "4", type: "Blue", suit: "Blue", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-80cdd336-3ab6-4336-a8a6-454b8d4a4ee5?alt=media&token=e436fbd3-7f1f-4720-81e1-c9df23ed3c36"},
    {name: "5", type: "Blue", suit: "Blue", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-19e7725c-a978-4ef6-8b0a-4237aa492341?alt=media&token=aa321827-bedd-4831-9012-c9d7f37319af"},
    {name: "6", type: "Blue", suit: "Blue", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-84b608dd-f4bb-4620-b0ea-b4c6454ac3a3?alt=media&token=92a80884-c2c8-4268-88d3-cd9262b84652"},
    {name: "7", type: "Blue", suit: "Blue", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3f69dbfb-4469-4125-bd97-57a3f87f9bac?alt=media&token=5528ad0a-e81f-4adb-9030-cdcaa995c66c"},
    {name: "8", type: "Blue", suit: "Blue", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3c97da1a-5f9b-420b-9799-a0b4c5db6da9?alt=media&token=d77f4bc5-abb4-4f83-b323-a99956e488c2"},
    {name: "9", type: "Blue", suit: "Blue", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6d46fbe1-c756-4d64-b586-a1376980ae5c?alt=media&token=1af10227-d0da-4862-8e49-dd94a48e1bd7"},
    {name: "1", type: "Blue", suit: "Blue", value: 1, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-17f2db52-c170-47fe-9678-a368842b8580?alt=media&token=8e67557e-8516-48e3-b844-528f284b7ae6"},
    {name: "2", type: "Blue", suit: "Blue", value: 2, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-37ae8467-3c89-40bc-91fb-f2f9452467b7?alt=media&token=321200d8-4f82-4929-bd7e-4043e7524202"},
    {name: "3", type: "Blue", suit: "Blue", value: 3, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-7281074f-6ba5-47be-8527-991e5e33a550?alt=media&token=c8a1eb6b-5c32-448f-a7a6-b0089887fd25"},
    {name: "4", type: "Blue", suit: "Blue", value: 4, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-80cdd336-3ab6-4336-a8a6-454b8d4a4ee5?alt=media&token=e436fbd3-7f1f-4720-81e1-c9df23ed3c36"},
    {name: "5", type: "Blue", suit: "Blue", value: 5, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-19e7725c-a978-4ef6-8b0a-4237aa492341?alt=media&token=aa321827-bedd-4831-9012-c9d7f37319af"},
    {name: "6", type: "Blue", suit: "Blue", value: 6, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-84b608dd-f4bb-4620-b0ea-b4c6454ac3a3?alt=media&token=92a80884-c2c8-4268-88d3-cd9262b84652"},
    {name: "7", type: "Blue", suit: "Blue", value: 7, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3f69dbfb-4469-4125-bd97-57a3f87f9bac?alt=media&token=5528ad0a-e81f-4adb-9030-cdcaa995c66c"},
    {name: "8", type: "Blue", suit: "Blue", value: 8, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-3c97da1a-5f9b-420b-9799-a0b4c5db6da9?alt=media&token=d77f4bc5-abb4-4f83-b323-a99956e488c2"},
    {name: "9", type: "Blue", suit: "Blue", value: 9, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6d46fbe1-c756-4d64-b586-a1376980ae5c?alt=media&token=1af10227-d0da-4862-8e49-dd94a48e1bd7"},
  
 
    {name: "Skip", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-1564fc01-2f80-448b-9b27-08f467de3266?alt=media&token=4fe79d84-6e48-47c6-b8a2-67b50e6a5d38"},
    {name: "Skip", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6beb290b-ffe5-48d5-a3af-c699860085f6?alt=media&token=13f2d506-5aa7-47e9-b461-98766ab1a328"},
    {name: "Skip", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-91e69aed-f778-43d2-a859-db943f3762a0?alt=media&token=931509b4-7b9a-4140-8e10-9fdfe76cb020"},
    {name: "Skip", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b0abaf8a-b136-4689-8edf-0dea595e4323?alt=media&token=6b33ddfb-5cf1-422f-95b6-b7dc9eb4b25a"},
    {name: "Skip", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-1564fc01-2f80-448b-9b27-08f467de3266?alt=media&token=4fe79d84-6e48-47c6-b8a2-67b50e6a5d38"},
    {name: "Skip", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6beb290b-ffe5-48d5-a3af-c699860085f6?alt=media&token=13f2d506-5aa7-47e9-b461-98766ab1a328"},
    {name: "Skip", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-91e69aed-f778-43d2-a859-db943f3762a0?alt=media&token=931509b4-7b9a-4140-8e10-9fdfe76cb020"},
    {name: "Skip", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b0abaf8a-b136-4689-8edf-0dea595e4323?alt=media&token=6b33ddfb-5cf1-422f-95b6-b7dc9eb4b25a"},
    {name: "Reverse", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-f7532ee0-47b4-4e6a-bdff-d0181b5c8c45?alt=media&token=8ba303b4-bdf7-4b89-ab1c-4d23780a2d62"},
    {name: "Reverse", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-d69a315c-6074-488d-a2dc-5c55dfec2140?alt=media&token=41e8c14d-d615-498b-adbd-862f322836e9"},
    {name: "Reverse", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0b051064-7a0a-4cd4-beca-c46a94f52282?alt=media&token=edc0fc16-d890-434e-b46f-4c92924a4d1b"},
    {name: "Reverse", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-28c62301-20ac-4c94-b722-5486082b1d77?alt=media&token=b57395bf-36aa-48a6-ad4c-de3022faab49"},
    {name: "Reverse", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-f7532ee0-47b4-4e6a-bdff-d0181b5c8c45?alt=media&token=8ba303b4-bdf7-4b89-ab1c-4d23780a2d62"},
    {name: "Reverse", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-d69a315c-6074-488d-a2dc-5c55dfec2140?alt=media&token=41e8c14d-d615-498b-adbd-862f322836e9"},
    {name: "Reverse", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-0b051064-7a0a-4cd4-beca-c46a94f52282?alt=media&token=edc0fc16-d890-434e-b46f-4c92924a4d1b"},
    {name: "Reverse", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-28c62301-20ac-4c94-b722-5486082b1d77?alt=media&token=b57395bf-36aa-48a6-ad4c-de3022faab49"},
    {name: "Draw 2", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-2edb40cc-3d49-4eff-9f95-4e9be22f7bb6?alt=media&token=ee05225d-4e03-41c1-85fb-87b30d6d09ec"},
    {name: "Draw 2", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-17c73f43-e147-4152-8f70-d30c3239d3ae?alt=media&token=c361ed32-3d38-40d4-b874-6da56ed75754"},
    {name: "Draw 2", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6baf91a8-8b0b-460d-ad63-f690c99e6703?alt=media&token=4afef284-55db-4f21-9c8d-4c799f1ea8f5"},
    {name: "Draw 2", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-8f23250c-1b10-4eba-ad83-ab69d8d67e28?alt=media&token=f4b43df8-57ff-4181-8967-a7293524241c"},
    {name: "Draw 2", type: "Red", suit: "Red", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-2edb40cc-3d49-4eff-9f95-4e9be22f7bb6?alt=media&token=ee05225d-4e03-41c1-85fb-87b30d6d09ec"},
    {name: "Draw 2", type: "Yellow", suit: "Yellow", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-17c73f43-e147-4152-8f70-d30c3239d3ae?alt=media&token=c361ed32-3d38-40d4-b874-6da56ed75754"},
    {name: "Draw 2", type: "Green", suit: "Green", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-6baf91a8-8b0b-460d-ad63-f690c99e6703?alt=media&token=4afef284-55db-4f21-9c8d-4c799f1ea8f5"},
    {name: "Draw 2", type: "Blue", suit: "Blue", value: 20, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-8f23250c-1b10-4eba-ad83-ab69d8d67e28?alt=media&token=f4b43df8-57ff-4181-8967-a7293524241c"},
    {name: "Wild", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b395425e-b67e-4d05-9be2-b2df77829e39?alt=media&token=ee57176c-8c00-40bd-9a6d-51ef40d1d3ec"},
    {name: "Wild Draw 4", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9edf02b7-014a-4212-a81a-6d97468bb1a0?alt=media&token=00290578-e11f-4a76-9b7e-a3529d2aa366"},
    {name: "Wild", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b395425e-b67e-4d05-9be2-b2df77829e39?alt=media&token=ee57176c-8c00-40bd-9a6d-51ef40d1d3ec"},
    {name: "Wild Draw 4", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9edf02b7-014a-4212-a81a-6d97468bb1a0?alt=media&token=00290578-e11f-4a76-9b7e-a3529d2aa366"},
    {name: "Wild", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b395425e-b67e-4d05-9be2-b2df77829e39?alt=media&token=ee57176c-8c00-40bd-9a6d-51ef40d1d3ec"},
    {name: "Wild Draw 4", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9edf02b7-014a-4212-a81a-6d97468bb1a0?alt=media&token=00290578-e11f-4a76-9b7e-a3529d2aa366"},
    {name: "Wild", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-b395425e-b67e-4d05-9be2-b2df77829e39?alt=media&token=ee57176c-8c00-40bd-9a6d-51ef40d1d3ec"},
    {name: "Wild Draw 4", type: "Wild", suit: "Wild", value: 50, url: "https://firebasestorage.googleapis.com/v0/b/playingcardsio.appspot.com/o/cfq58g-9edf02b7-014a-4212-a81a-6d97468bb1a0?alt=media&token=00290578-e11f-4a76-9b7e-a3529d2aa366"},

  ];

module.exports = unoCards;