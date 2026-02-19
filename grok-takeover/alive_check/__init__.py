import azure.functions as func
import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    resp = func.HttpResponse(f"GROK4.1 alive at {datetime.datetime.utcnow()}", status_code=200)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp
