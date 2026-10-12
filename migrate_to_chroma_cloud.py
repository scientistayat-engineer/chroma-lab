import os

import chromadb
from dotenv import load_dotenv


load_dotenv()


LOCAL_CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "knowledge_base"
BATCH_SIZE = 100


# ---------------------------------------
# LOCAL CHROMADB
# ---------------------------------------

local_client = chromadb.PersistentClient(
    path=LOCAL_CHROMA_PATH
)

local_collection = local_client.get_collection(
    name=COLLECTION_NAME
)


# ---------------------------------------
# CHROMA CLOUD
# ---------------------------------------

cloud_client = chromadb.CloudClient(
    api_key=os.getenv("CHROMA_API_KEY"),
    tenant=os.getenv("CHROMA_TENANT"),
    database=os.getenv("CHROMA_DATABASE"),
)


cloud_collection = cloud_client.get_or_create_collection(
    name=COLLECTION_NAME
)


# ---------------------------------------
# CHECK LOCAL DATA
# ---------------------------------------

total = local_collection.count()

print(f"Local collection contains {total} records.")


# ---------------------------------------
# COPY DATA IN BATCHES
# ---------------------------------------

for offset in range(
    0,
    total,
    BATCH_SIZE
):

    result = local_collection.get(
        limit=BATCH_SIZE,
        offset=offset,
        include=[
            "documents",
            "metadatas",
            "embeddings",
        ],
    )

    ids = result["ids"]

    documents = result["documents"]

    metadatas = result["metadatas"]

    embeddings = result["embeddings"]


    if not ids:
        continue


    cloud_collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )


    print(
        f"Uploaded "
        f"{min(offset + len(ids), total)}"
        f"/{total}"
    )


print("\nMigration completed.")

print(
    "Cloud collection count:",
    cloud_collection.count()
)
