import requests
from .bboxConstant import BboxConstant
from .bboxAuth import BboxAuth
from .bboxApiURL import BboxAPIUrl


class BboxApiCall:

    def __init__(self, bbox_api_url, http_method=BboxConstant.HTTP_METHOD_GET,
                 parameters=None, auth=None):
        """
        Initiate an API request with all parameters
        Structure of auth parameter
        :param http_method: string
        :param bbox_api_url: BboxAPIUrl
        :param parameters: dict
        :param auth: BboxAuth
        """
        self.http_method = http_method
        self.api_url = bbox_api_url
        self.parameters = parameters
        # Dict with local auth needed, remote auth needed and current level of auth
        self.auth = auth
        # Get the right call method
        if http_method == BboxConstant.HTTP_METHOD_GET:
            self.call_method = requests.get
        elif http_method == BboxConstant.HTTP_METHOD_POST:
            self.call_method = requests.post
        elif http_method == BboxConstant.HTTP_METHOD_PUT:
            self.call_method = requests.put

    def execute_api_request(self):
        """
        Execute the request and return json data as a dict
        :return: data dict
        """
        if not self.auth.check_auth():
            raise Exception('Authentification needed or API not available with your type of connection')
        if self.auth.is_authentified():
            id_cookie = {BboxConstant.COOKIE_BBOX_ID: self.auth.get_cookie_id()}
            if self.parameters is None:
                resp = self.call_method(self.api_url.get_url(), cookies=id_cookie)
            else:
                resp = self.call_method(self.api_url.get_url(),
                                        data=self.parameters, cookies=id_cookie)
        else:
            if self.parameters is None:
                resp = self.call_method(self.api_url.get_url())
            else:
                resp = self.call_method(self.api_url.get_url(),
                                        data=self.parameters)
        if resp.status_code != 200 and resp.status_code != 201:
            # This means something went wrong.
            raise Exception('Error {} with request {}'.format(
                resp.status_code, self.api_url.get_url()))

        return resp
