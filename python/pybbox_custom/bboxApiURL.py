from .bboxConstant import BboxConstant
import netaddr as net


class BboxAPIUrl:
    """
    Used to handle API url
    """

    API_PREFIX = "api/v1"

    def __init__(self, api_class, api_method, ip=BboxConstant.DEFAULT_LOCAL_IP):
        """
        :param api_class: string
        :param api_method: string
        :param ip: string
        :return:
        """

        self.api_class = api_class
        self.api_method = api_method
        self.ip = ip
        self.authentication_type = None
        self.url = None
        self.build_url_request()

    def get_api_class(self):
        return self.api_class

    def get_api_method(self):
        return self.api_method

    def get_ip(self):
        return self.ip

    def get_url(self):
        return self.url

    def get_authentication_type(self):
        return self.authentication_type

    def set_api_name(self, api_class, api_method):
        self.api_class = api_class
        self.api_method = api_method
        self.build_url_request()

    def build_url_request(self):
        """
        Build the url to use for making a call to the Bbox API
        :return: url string
        """
        # Check if the ip is LAN or WAN
        if True:
            url = "https://mabbox.bytel.fr"
            self.authentication_type = BboxConstant.AUTHENTICATION_TYPE_LOCAL
        else:
            url = "https://{}:{}".format(self.ip,
                                         BboxConstant.DEFAULT_REMOTE_PORT)
            self.authentication_type = BboxConstant.AUTHENTICATION_TYPE_REMOTE

        if self.api_class is None:
            url = "{}/{}".format(url, self.API_PREFIX)
        else:
            url = "{}/{}/{}".format(url, self.API_PREFIX, self.api_class)

        if self.api_method is None:
            self.url = url
        else:
            self.url = "{}/{}".format(url, self.api_method)
